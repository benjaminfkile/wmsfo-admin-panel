import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { thresholds } from "./thresholds";

describe("thresholds", () => {
  it("matches the vendored contracts/admin-thresholds.json", () => {
    const raw = readFileSync(
      join(process.cwd(), "contracts/admin-thresholds.json"),
      "utf-8"
    );
    const vendored = JSON.parse(raw) as {
      batteryLowPercent: number;
      noFixAgeS: number;
      noLocationAgeS: number;
    };
    expect(thresholds).toEqual(vendored);
  });
});
