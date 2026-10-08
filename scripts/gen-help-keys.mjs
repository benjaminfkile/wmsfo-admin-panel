#!/usr/bin/env node
// Writes src/help/helpKeys.ts from contracts/help-keys.json: the help
// topic keys in file order, the `HelpKey` union, and each key's page
// and label. With `--stdout` the source goes to standard output and no
// file is written, which is how the staleness test compares the two.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "contracts", "help-keys.json");
const TARGET = path.join(ROOT, "src", "help", "helpKeys.ts");

function renderHelpKeys(entries) {
  const lines = [
    "// Generated from contracts/help-keys.json by `npm run gen:help-keys`.",
    "// Edit the contract and regenerate; a test fails while this file is stale.",
    "",
    "export const HELP_KEYS = [",
    ...entries.map((e) => `  ${JSON.stringify(e.key)},`),
    "] as const;",
    "",
    "export type HelpKey = (typeof HELP_KEYS)[number];",
    "",
    "export const HELP_PAGES: Record<HelpKey, { page: string; label: string }> = {",
    ...entries.map(
      (e) =>
        `  ${JSON.stringify(e.key)}: { page: ${JSON.stringify(e.page)}, label: ${JSON.stringify(e.label)} },`
    ),
    "};",
    "",
  ];
  return lines.join("\n");
}

const entries = JSON.parse(readFileSync(SOURCE, "utf8"));
const source = renderHelpKeys(entries);
if (process.argv.includes("--stdout")) {
  process.stdout.write(source);
} else {
  writeFileSync(TARGET, source);
  process.stdout.write(`gen-help-keys: ${entries.length} keys written to src/help/helpKeys.ts\n`);
}
