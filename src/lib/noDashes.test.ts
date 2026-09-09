import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const EM_DASH = "\u2014";
const EN_DASH = "\u2013";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      walk(full, out);
    } else if (info.isFile()) {
      out.push(full);
    }
  }
  return out;
}

describe("no em or en dashes in src/", () => {
  it("scans src/ and finds no U+2014 or U+2013 characters", () => {
    const root = join(process.cwd(), "src");
    const hits: string[] = [];
    for (const file of walk(root)) {
      const rel = relative(process.cwd(), file);
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (line.includes(EM_DASH) || line.includes(EN_DASH)) {
          hits.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});
