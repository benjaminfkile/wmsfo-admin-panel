#!/usr/bin/env node
// Verifies that the vendored contracts/ directory is byte-identical to
// the wmsfo-api commit named in CONTRACTS_SHA. Fetches the tarball,
// extracts it into a temp directory (Windows-safe: relative archive
// name, tar cwd set to that directory), then diffs contracts/ against
// the vendored copy.
//
// Optional env:
//   GITHUB_TOKEN or GH_TOKEN: used for the tarball fetch (CI on
//     private repos needs it; unauthenticated works when the repo is
//     public or when the token in `origin` is available and passed in).
//   CONTRACTS_REPO: override the default owner/repo.

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const REPO = process.env.CONTRACTS_REPO ?? "benjaminfkile/wmsfo-api";
const ROOT = process.cwd();
const SHA_PATH = path.join(ROOT, "CONTRACTS_SHA");
const VENDORED = path.join(ROOT, "contracts");

async function main() {
  const sha = (await readFile(SHA_PATH, "utf8")).trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    fail(`CONTRACTS_SHA is not a 40-char SHA: "${sha}"`);
  }

  const tmp = await mkdtemp(path.join(tmpdir(), "contracts-check-"));
  try {
    const tarPath = path.join(tmp, "repo.tar.gz");
    await downloadTarball(sha, tarPath);
    // Windows: pass a relative archive name with tar's cwd set to tmp,
    // because a drive-letter absolute path (C:\...) is read by tar as
    // a remote host.
    await run("tar", ["-xzf", "repo.tar.gz"], { cwd: tmp });

    const entries = await readdir(tmp, { withFileTypes: true });
    const top = entries
      .filter((e) => e.isDirectory() && e.name.includes(sha.slice(0, 7)))
      .map((e) => e.name);
    if (top.length !== 1) {
      fail(`expected one extracted directory containing ${sha.slice(0, 7)}, got ${top.join(", ")}`);
    }
    const upstream = path.join(tmp, top[0], "contracts");
    const upstreamStat = await stat(upstream).catch(() => null);
    if (!upstreamStat?.isDirectory()) {
      fail(`upstream tarball has no contracts/ at ${sha}`);
    }

    const diff = await diffDirs(upstream, VENDORED);
    if (diff.length > 0) {
      const lines = diff.slice(0, 200).map((d) => `  ${d}`).join("\n");
      fail(
        `vendored contracts/ differs from ${REPO}@${sha}:\n${lines}\n` +
          `Update: replace contracts/ with the upstream copy and bump CONTRACTS_SHA in one commit.`
      );
    }

    console.log(`contracts/ matches ${REPO}@${sha}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

function fail(msg) {
  process.stderr.write(`check-contracts: ${msg}\n`);
  process.exit(1);
}

async function downloadTarball(sha, dest) {
  const url = `https://api.github.com/repos/${REPO}/tarball/${sha}`;
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const headers = {
    "User-Agent": "check-contracts",
    Accept: "application/vnd.github.v3.raw",
  };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) {
    fail(`GitHub tarball fetch failed: ${res.status} ${res.statusText}`);
  }
  await pipeline(res.body, createWriteStream(dest));
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    // Never spawn a node_modules/.bin shim directly; on Windows those
    // are .cmd wrappers and require shell: true. `tar` is a system
    // binary so a bare spawn is fine on POSIX and Windows (cmd.exe
    // resolves tar.exe via PATH under shell: true).
    const child = spawn(cmd, args, {
      cwd: opts?.cwd,
      stdio: ["ignore", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

async function diffDirs(a, b) {
  const problems = [];
  const [aList, bList] = await Promise.all([listAll(a), listAll(b)]);
  const aSet = new Set(aList);
  const bSet = new Set(bList);
  for (const rel of aList) {
    if (!bSet.has(rel)) problems.push(`missing in vendored: ${rel}`);
  }
  for (const rel of bList) {
    if (!aSet.has(rel)) problems.push(`extra in vendored: ${rel}`);
  }
  for (const rel of aList) {
    if (!bSet.has(rel)) continue;
    const [ab, bb] = await Promise.all([
      readFile(path.join(a, rel)),
      readFile(path.join(b, rel)),
    ]);
    if (!bytesEqual(ab, bb)) problems.push(`content differs: ${rel}`);
  }
  return problems;
}

async function listAll(root) {
  const out = [];
  async function walk(dir, prefix) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, rel);
      else if (e.isFile()) out.push(rel);
    }
  }
  await walk(root, "");
  out.sort();
  return out;
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

main().catch((e) => fail(e.stack ?? String(e)));
