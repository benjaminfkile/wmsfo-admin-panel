import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// admin.md 6.3: a poster is its own document, so no source file reads or
// writes a poster layout on an event. The layout module's own name
// (`posterLayout.ts` and its imports) is not a field.
const FIELD = "posterLayout";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("the event carries no poster layout", () => {
  it("no source file under src/ names the event's posterLayout field", () => {
    const root = join(process.cwd(), "src");
    const hits: string[] = [];
    for (const file of walk(root)) {
      if (!/\.(ts|tsx)$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
      const rel = relative(process.cwd(), file);
      readFileSync(file, "utf-8")
        .split("\n")
        .forEach((line, i) => {
          const field = line.replace(/posterLayout(?=["'.])/g, "");
          if (field.includes(FIELD)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("the event route leaves no poster studio behind", () => {
    const routes = readFileSync(join(process.cwd(), "src", "AppRoutes.tsx"), "utf-8");
    expect(routes).not.toMatch(/events\/:id\/poster/);
    expect(routes).toMatch(/path="posters\/:id"/);
  });
});
