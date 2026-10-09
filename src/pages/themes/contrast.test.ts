// admin.md 9.1: the chrome contrast rule, WCAG relative luminance with
// the alpha of an `#rrggbbaa` composited over the other colour.

import { describe, expect, it } from "vitest";
import seed from "../../../contracts/fixtures/themes/seed.json";
import {
  composite,
  contrastRatio,
  formatRatio,
  parseHex,
  passes,
  relativeLuminance,
} from "./contrast";

describe("contrast", () => {
  it("reads #rrggbb and #rrggbbaa and refuses anything else", () => {
    expect(parseHex("#ff8000")).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(parseHex("#ff800080")?.a).toBeCloseTo(128 / 255);
    expect(parseHex("#fff")).toBeNull();
    expect(parseHex("red")).toBeNull();
    expect(contrastRatio("#fff", "#000000")).toBeNull();
  });

  it("gives the WCAG relative luminance of white, black, and a grey", () => {
    expect(relativeLuminance(parseHex("#ffffff")!)).toBeCloseTo(1);
    expect(relativeLuminance(parseHex("#000000")!)).toBeCloseTo(0);
    expect(relativeLuminance(parseHex("#777777")!)).toBeCloseTo(0.1845, 3);
  });

  it("measures black on white at 21:1 and #777777 on white just under 4.5:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    const grey = contrastRatio("#777777", "#ffffff")!;
    expect(grey).toBeCloseTo(4.48, 2);
    expect(passes(grey)).toBe(false);
    expect(formatRatio(grey)).toBe("4.47");
  });

  it("composites the alpha of #rrggbbaa over the other colour", () => {
    const over = composite(parseHex("#00000080")!, parseHex("#ffffff")!);
    expect(over.r).toBeCloseTo(255 * (1 - 128 / 255));
    // Half-transparent black text on white is a mid grey, not black.
    const translucent = contrastRatio("#00000080", "#ffffff")!;
    expect(translucent).toBeLessThan(contrastRatio("#000000", "#ffffff")!);
    expect(translucent).toBeCloseTo(contrastRatio("#7f7f7f", "#ffffff")!, 1);
    // A translucent background is composited over the text colour.
    expect(contrastRatio("#ffffff", "#00000000")).toBeCloseTo(1);
  });

  it("passes the six seeded Google chromes on both pairs", () => {
    const google = seed.filter((t) => t.renderer === "google");
    expect(google).toHaveLength(6);
    for (const t of google) {
      expect(passes(contrastRatio(t.chrome.text, t.chrome.bg))).toBe(true);
      expect(passes(contrastRatio(t.chrome.tileFg, t.chrome.tile))).toBe(true);
    }
  });

  it("fails a pair below 4.5:1", () => {
    expect(passes(contrastRatio("#999999", "#ffffff"))).toBe(false);
    expect(passes(contrastRatio("#1a56c4", "#1e2b40"))).toBe(false);
    expect(passes(null)).toBe(false);
  });
});
