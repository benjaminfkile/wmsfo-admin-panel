// admin.md 6.28, 7.2: the theme form's overlay colours, headingColor
// among them, from the seed defaults through the rules to the create body
// and the edit patch.

import { describe, expect, it } from "vitest";
import seed from "../../../contracts/fixtures/themes/seed.json";
import * as f from "../../test/msw/fixtures";
import type { TrackerTheme } from "../../api/types";
import {
  HEX_RULE,
  OVERLAY_COLOUR_KEYS,
  OVERLAY_LABELS,
  createBody,
  editPatch,
  initialForm,
  validate,
} from "./themeForm";

function byKey(key: string): TrackerTheme {
  return f.trackerThemes.find((t) => t.key === key)!;
}

const seedRow = (key: string) => seed.find((t) => t.key === key)!;

describe("themeForm headingColor", () => {
  it("is the last overlay colour, labelled Santa's heading beam", () => {
    expect(OVERLAY_COLOUR_KEYS[OVERLAY_COLOUR_KEYS.length - 1]).toBe("headingColor");
    expect(OVERLAY_COLOUR_KEYS.indexOf("headingColor")).toBe(
      OVERLAY_COLOUR_KEYS.indexOf("userColor") + 1,
    );
    expect(OVERLAY_LABELS.headingColor).toBe("Santa's heading beam");
  });

  it("a new theme takes it from the renderer's light seed", () => {
    expect(initialForm(null, "maplibre").overlay.headingColor).toBe(
      seedRow("light").overlay.headingColor,
    );
    expect(initialForm(null, "google").overlay.headingColor).toBe(
      seedRow("standard").overlay.headingColor,
    );
  });

  it("an edit opens with the theme's own", () => {
    expect(initialForm(byKey("nebula")).overlay.headingColor).toBe(
      seedRow("nebula").overlay.headingColor,
    );
  });

  it("the create body carries it", () => {
    const form = { ...initialForm(null, "maplibre"), key: "candy", name: "Candy" };
    form.overlay = { ...form.overlay, headingColor: " #00ff00 " };
    const body = createBody(form, {}, 30);
    expect(body.overlay.headingColor).toBe("#00ff00");
    expect(Object.keys(body.overlay)).toHaveLength(8);
  });

  it("the edit patch carries the whole overlay when only it changes", () => {
    const start = initialForm(byKey("night"));
    const next = { ...start, overlay: { ...start.overlay, headingColor: "#123456" } };
    expect(editPatch(start, next, undefined)).toEqual({
      overlay: { ...seedRow("night").overlay, headingColor: "#123456" },
    });
  });

  it("a bad value shows the hex rule", () => {
    const start = initialForm(byKey("night"));
    const bad = { ...start, overlay: { ...start.overlay, headingColor: "orange" } };
    expect(validate(bad, true)["overlay.headingColor"]).toBe(HEX_RULE);
    expect(validate(start, true)["overlay.headingColor"]).toBeUndefined();
  });
});
