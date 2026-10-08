import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HELP_KEYS, HELP_PAGES } from "./helpKeys";

describe("helpKeys.ts", () => {
  it("matches what gen:help-keys writes from contracts/help-keys.json", () => {
    const fresh = execFileSync(
      process.execPath,
      [join(process.cwd(), "scripts", "gen-help-keys.mjs"), "--stdout"],
      { cwd: process.cwd(), encoding: "utf-8" }
    );
    const committed = readFileSync(
      join(process.cwd(), "src", "help", "helpKeys.ts"),
      "utf-8"
    );
    expect(committed).toBe(fresh);
  });

  it("lists every contract key in order with its page and label", () => {
    const vendored = JSON.parse(
      readFileSync(join(process.cwd(), "contracts", "help-keys.json"), "utf-8")
    ) as Array<{ key: string; page: string; label: string }>;
    expect([...HELP_KEYS]).toEqual(vendored.map((e) => e.key));
    for (const e of vendored) {
      expect(HELP_PAGES[e.key as (typeof HELP_KEYS)[number]]).toEqual({
        page: e.page,
        label: e.label,
      });
    }
  });
});
