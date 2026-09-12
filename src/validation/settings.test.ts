import { describe, expect, it } from "vitest";
import { SETTING_SPECS, specFor, validateSettingValue } from "./settings";

describe("SETTING_SPECS", () => {
  it("lists the six documented keys in the documented order", () => {
    expect(SETTING_SPECS.map((s) => s.key)).toEqual([
      "poll_interval_ms",
      "cookie_limit_per_person",
      "sponsor_linger_ms_per_dollar",
      "sponsor_linger_min_ms",
      "beacon_stale_after_s",
      "flight_history_max_points",
    ]);
  });
});

describe("specFor", () => {
  it("returns the spec by key", () => {
    expect(specFor("poll_interval_ms")?.min).toBe(1000);
  });
  it("returns null for an unknown key", () => {
    expect(specFor("nope")).toBeNull();
  });
});

describe("validateSettingValue", () => {
  it("rejects non-integers", () => {
    const s = specFor("poll_interval_ms")!;
    const r = validateSettingValue(s, "1500.5");
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range values on the low end", () => {
    const s = specFor("poll_interval_ms")!;
    const r = validateSettingValue(s, "999");
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range values on the high end", () => {
    const s = specFor("beacon_stale_after_s")!;
    const r = validateSettingValue(s, "3601");
    expect(r.ok).toBe(false);
  });

  it("accepts values inside the range", () => {
    const s = specFor("cookie_limit_per_person")!;
    const r = validateSettingValue(s, "10");
    expect(r).toEqual({ ok: true, value: 10 });
  });

  it("rejects an empty string", () => {
    const s = specFor("poll_interval_ms")!;
    const r = validateSettingValue(s, "  ");
    expect(r.ok).toBe(false);
  });
});
