import type { Page, TestInfo } from "@playwright/test";
import { TOTP } from "otpauth";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// A dev admin and a dev editor, both with TOTP enabled on the dev Cognito
// pool. The workflow supplies these through the `dev` GitHub environment;
// running locally reads them from `.env.local`.
export type DevUser = {
  email: string;
  password: string;
  totpSecret: string;
};

export function readAdmin(): DevUser {
  return {
    email: required("E2E_ADMIN_EMAIL"),
    password: required("E2E_ADMIN_PASSWORD"),
    totpSecret: required("E2E_ADMIN_TOTP_SECRET"),
  };
}

export function readEditor(): DevUser {
  return {
    email: required("E2E_EDITOR_EMAIL"),
    password: required("E2E_EDITOR_PASSWORD"),
    totpSecret: required("E2E_EDITOR_TOTP_SECRET"),
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `${name} is not set. Populate .env.local or the dev GitHub environment.`,
    );
  }
  return v.trim();
}

export function totpCode(secret: string): string {
  return new TOTP({ secret, digits: 6, period: 30, algorithm: "SHA1" }).generate();
}

export function readDevCdnBase(): string {
  return required("VITE_CDN_BASE_URL").replace(/\/+$/, "");
}

// Sign-in walks the Cognito hosted UI: username, password, TOTP. Selectors
// are the shared "amplify auth" screens the pool uses; anything more brittle
// than a text/label lookup will drift the moment AWS reflows the page.
// Cognito refuses a TOTP code that was already used, and consecutive specs sign
// in faster than the 30 s window turns over. Remember the last code per secret
// and wait for the next window when it would repeat.
// Playwright loads each spec file in a fresh module scope, so the memory lives
// in a temp file keyed by a hash of the secret.
function totpMemoryPath(secret: string): string {
  const key = createHash("sha256").update(secret).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), `wmsfo-e2e-totp-${key}`);
}
export async function freshTotpCode(secret: string): Promise<string> {
  const memory = totpMemoryPath(secret);
  const last = existsSync(memory) ? readFileSync(memory, "utf8").trim() : "";
  let code = totpCode(secret);
  while (last === code) {
    const wait = 30_000 - (Date.now() % 30_000) + 500;
    await new Promise((r) => setTimeout(r, wait));
    code = totpCode(secret);
  }
  writeFileSync(memory, code);
  return code;
}

export async function signIn(page: Page, user: DevUser): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /sign in/i }).first().click();
  // The classic hosted UI renders the form twice (one copy hidden per
  // breakpoint) and its visible inputs carry no associated label, so every
  // lookup goes by field name and takes the visible copy.
  await page.locator('input[name="username"]:visible').first().fill(user.email);
  await page.locator('input[name="password"]:visible').first().fill(user.password);
  const submit = 'input[type="submit" i]:visible, button[type="submit"]:visible';
  await page.locator(submit).first().click();
  await page.locator('input[name="totpCode"]:visible, input#totpCodeInput:visible').first().fill(await freshTotpCode(user.totpSecret));
  await page.locator(submit).first().click();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: /sign out/i }).click();
}

// Poll a JSON object at the dev CDN until `check` accepts it or `timeoutMs`
// elapses. Used to assert that a panel action shows up on the CDN within the
// documented 10-second window.
export async function waitForCdnJson<T>(
  url: string,
  check: (json: T) => boolean,
  timeoutMs = 15_000,
  intervalMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as T;
        if (check(json)) return json;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `CDN JSON at ${url} never satisfied the predicate within ${timeoutMs} ms` +
      (lastError ? ` (last error: ${String(lastError)})` : ""),
  );
}

// Attach an artefact to the test report so debugging a CI failure does not
// require a rerun. Small enough to be safe for text bodies.
export async function attachText(
  info: TestInfo,
  name: string,
  body: string,
): Promise<void> {
  await info.attach(name, { body, contentType: "text/plain" });
}
