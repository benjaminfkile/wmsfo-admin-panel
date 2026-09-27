import { describe, expect, it } from "vitest";
import {
  ageS,
  formatAgeS,
  formatStamp,
  formatStampDate,
  formatStampTime,
  fromLocalInputValue,
  timeZoneOptions,
  toLocalInputValue,
  shiftWallZone,
  utcToWallTime,
  wallTimeToUtc,
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

describe("wallTimeToUtc and utcToWallTime", () => {
  const denver = "America/Denver";

  const roundTrips = (wall: string, iso: string, zone: string) => {
    expect(wallTimeToUtc(wall, zone)).toBe(iso);
    expect(utcToWallTime(iso, zone)).toBe(wall);
  };

  it("round-trips across the spring forward of 2026-03-08 in Denver", () => {
    roundTrips("2026-03-07T12:00", "2026-03-07T19:00:00.000Z", denver);
    roundTrips("2026-03-08T01:59", "2026-03-08T08:59:00.000Z", denver);
    roundTrips("2026-03-08T03:00", "2026-03-08T09:00:00.000Z", denver);
    roundTrips("2026-03-09T12:00", "2026-03-09T18:00:00.000Z", denver);
  });

  it("reads a skipped spring forward wall time past the change", () => {
    expect(wallTimeToUtc("2026-03-08T02:30", denver)).toBe(
      "2026-03-08T09:30:00.000Z"
    );
    expect(utcToWallTime("2026-03-08T09:30:00.000Z", denver)).toBe(
      "2026-03-08T03:30"
    );
  });

  it("round-trips across the fall back of 2026-11-01 in Denver", () => {
    roundTrips("2026-10-31T12:00", "2026-10-31T18:00:00.000Z", denver);
    roundTrips("2026-11-01T00:30", "2026-11-01T06:30:00.000Z", denver);
    roundTrips("2026-11-01T01:30", "2026-11-01T07:30:00.000Z", denver);
    roundTrips("2026-11-01T02:00", "2026-11-01T09:00:00.000Z", denver);
    roundTrips("2026-11-02T12:00", "2026-11-02T19:00:00.000Z", denver);
  });

  it("reads a repeated fall back wall time as its first occurrence", () => {
    expect(utcToWallTime("2026-11-01T08:30:00.000Z", denver)).toBe(
      "2026-11-01T01:30"
    );
    expect(wallTimeToUtc("2026-11-01T01:30", denver)).toBe(
      "2026-11-01T07:30:00.000Z"
    );
  });

  it("round-trips in UTC, midnight included", () => {
    roundTrips("2026-03-08T02:30", "2026-03-08T02:30:00.000Z", "UTC");
    roundTrips("2026-11-01T01:30", "2026-11-01T01:30:00.000Z", "UTC");
    roundTrips("2026-07-04T00:00", "2026-07-04T00:00:00.000Z", "UTC");
  });

  it("shiftWallZone keeps the instant across a zone switch", () => {
    expect(shiftWallZone("2026-12-19T19:00", "America/Chicago", denver)).toBe(
      "2026-12-19T18:00"
    );
    expect(shiftWallZone("2026-12-19T18:00", denver, "UTC")).toBe(
      "2026-12-20T01:00"
    );
    expect(shiftWallZone("2026-12-19T18:00", denver, denver)).toBe(
      "2026-12-19T18:00"
    );
  });

  it("shiftWallZone leaves empty or unparseable text as typed", () => {
    expect(shiftWallZone("", "America/Chicago", denver)).toBe("");
    expect(shiftWallZone("2026-12-19T1", "America/Chicago", denver)).toBe(
      "2026-12-19T1"
    );
    expect(shiftWallZone("2026-12-19T19:00", "Not/AZone", denver)).toBe(
      "2026-12-19T19:00"
    );
  });

  it("returns empty for missing, malformed, or unknown input", () => {
    expect(wallTimeToUtc("", denver)).toBeNull();
    expect(wallTimeToUtc(null, denver)).toBeNull();
    expect(wallTimeToUtc("2026-03-08 02:30", denver)).toBeNull();
    expect(wallTimeToUtc("2026-03-08T02:30", "Not/AZone")).toBeNull();
    expect(utcToWallTime(null, denver)).toBe("");
    expect(utcToWallTime("not a date", denver)).toBe("");
    expect(utcToWallTime("2026-03-08T09:30:00.000Z", "Not/AZone")).toBe("");
  });

  it("lists zones with UTC and any extra zone included", () => {
    const zones = timeZoneOptions("Etc/GMT+7");
    expect(zones).toContain("UTC");
    expect(zones).toContain("Etc/GMT+7");
    expect(zones).toContain(denver);
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
