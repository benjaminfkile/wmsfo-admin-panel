import { describe, expect, it } from "vitest";
import {
  ageS,
  formatAgeS,
  formatMt,
  fromLocalInputValue,
  toLocalInputValue,
} from "./time";

describe("formatMt", () => {
  it("renders MST (UTC-7) in winter", () => {
    // 2026-12-22T01:31:07Z is 2026-12-21 18:31:07 in America/Denver.
    expect(formatMt("2026-12-22T01:31:07.000Z")).toBe(
      "2026-12-21 18:31:07 MT"
    );
  });

  it("renders MDT (UTC-6) in summer", () => {
    // 2026-07-04T12:00:00Z is 2026-07-04 06:00:00 in America/Denver.
    expect(formatMt("2026-07-04T12:00:00.000Z")).toBe(
      "2026-07-04 06:00:00 MT"
    );
  });

  it("returns empty for null and invalid input", () => {
    expect(formatMt(null)).toBe("");
    expect(formatMt(undefined)).toBe("");
    expect(formatMt("not a date")).toBe("");
  });
});

describe("datetime-local round trip", () => {
  it("round trips a valid local input value", () => {
    // Use a value in the browser zone (jsdom defaults to UTC).
    const iso = "2026-07-04T12:00:00.000Z";
    const local = toLocalInputValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const round = fromLocalInputValue(local);
    // Minute precision, so the seconds/ms are truncated on the return trip.
    expect(round).toBe("2026-07-04T12:00:00.000Z");
  });

  it("returns null for empty and invalid input", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue(null)).toBeNull();
    expect(fromLocalInputValue("not a date")).toBeNull();
    expect(toLocalInputValue("")).toBe("");
  });
});

describe("ageS and formatAgeS", () => {
  it("computes seconds", () => {
    const then = "2026-12-22T01:31:07.000Z";
    const now = new Date("2026-12-22T01:31:37.000Z").getTime();
    expect(ageS(then, now)).toBe(30);
  });

  it("returns null on bad input", () => {
    expect(ageS(null, 0)).toBeNull();
    expect(ageS("not a date", 0)).toBeNull();
  });

  it("formats short and long ages", () => {
    expect(formatAgeS(0)).toBe("0s");
    expect(formatAgeS(45)).toBe("45s");
    expect(formatAgeS(60)).toBe("1m");
    expect(formatAgeS(3600)).toBe("1h");
    expect(formatAgeS(3660)).toBe("1h 1m");
    expect(formatAgeS(86400)).toBe("1d");
    expect(formatAgeS(null)).toBe("");
    expect(formatAgeS(-5)).toBe("0s");
  });
});
