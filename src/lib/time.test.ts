import { describe, expect, it } from "vitest";
import {
  ageS,
  formatAgeS,
  formatStamp,
  formatStampDate,
  formatStampTime,
  fromLocalInputValue,
  toLocalInputValue,
} from "./time";

describe("formatStamp", () => {
  const winter = "2026-12-22T01:31:07.000Z";
  const summer = "2026-07-04T12:00:00.000Z";

  it("renders the instant in the given zone with its short name", () => {
    expect(formatStamp(winter, "America/Chicago")).toBe(
      "2026-12-21 19:31:07 CST"
    );
    expect(formatStamp(winter, "America/New_York")).toBe(
      "2026-12-21 20:31:07 EST"
    );
    expect(formatStamp(winter, "UTC")).toBe("2026-12-22 01:31:07 UTC");
  });

  it("follows daylight saving in the given zone", () => {
    expect(formatStamp(summer, "America/Chicago")).toBe(
      "2026-07-04 07:00:00 CDT"
    );
    expect(formatStamp(summer, "America/Los_Angeles")).toBe(
      "2026-07-04 05:00:00 PDT"
    );
  });

  it("renders midnight as 00, not 24", () => {
    expect(formatStamp("2026-07-04T00:00:00.000Z", "UTC")).toBe(
      "2026-07-04 00:00:00 UTC"
    );
  });

  it("uses the browser zone when no zone is given", () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(formatStamp(winter)).toBe(formatStamp(winter, zone));
    expect(formatStamp(winter)).not.toMatch(/ MT$/);
  });

  it("returns empty for null and invalid input", () => {
    expect(formatStamp(null)).toBe("");
    expect(formatStamp(undefined)).toBe("");
    expect(formatStamp("not a date")).toBe("");
  });
});

describe("formatStampDate and formatStampTime", () => {
  const winter = "2026-12-22T01:31:07.000Z";

  it("render the date in the given zone with its short name", () => {
    expect(formatStampDate(winter, "America/Chicago")).toBe(
      "Dec 21, 2026 CST"
    );
    expect(formatStampDate(winter, "UTC")).toBe("Dec 22, 2026 UTC");
  });

  it("render the time in the given zone with its short name", () => {
    expect(formatStampTime(winter, "America/Chicago")).toBe("19:31:07 CST");
    expect(formatStampTime(winter, "America/New_York")).toBe("20:31:07 EST");
  });

  it("return empty for null and invalid input", () => {
    expect(formatStampDate(null)).toBe("");
    expect(formatStampDate("not a date")).toBe("");
    expect(formatStampTime(undefined)).toBe("");
    expect(formatStampTime("not a date")).toBe("");
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
