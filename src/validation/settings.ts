// Client-side rules for the settings keys (admin.md 6.9, contracts 6, 7.2).

export type SettingKey =
  | "poll_interval_ms"
  | "cookie_limit_per_person"
  | "sponsor_linger_ms_per_dollar"
  | "sponsor_linger_min_ms"
  | "beacon_stale_after_s"
  | "flight_history_max_points"
  | "location_min_interval_ms"
  | "location_min_distance_m";

export type SettingSpec = {
  key: SettingKey;
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  // `location_min_distance_m` is the only key whose JSON type is number,
  // not int (contracts 6); every other spec accepts whole numbers only.
  allowDecimal?: boolean;
};

export const SETTING_SPECS: SettingSpec[] = [
  {
    key: "poll_interval_ms",
    label: "poll_interval_ms",
    description: "How often the public site polls the CDN",
    unit: "ms",
    min: 1000,
    max: 60000,
  },
  {
    key: "cookie_limit_per_person",
    label: "cookie_limit_per_person",
    description:
      "Cookies one person may leave per event (hidden ones count)",
    unit: "",
    min: 0,
    max: 1000,
  },
  {
    key: "sponsor_linger_ms_per_dollar",
    label: "sponsor_linger_ms_per_dollar",
    description: "Sponsor carousel time per dollar donated",
    unit: "ms",
    min: 0,
    max: 100000,
  },
  {
    key: "sponsor_linger_min_ms",
    label: "sponsor_linger_min_ms",
    description: "Minimum sponsor carousel time",
    unit: "ms",
    min: 0,
    max: 600000,
  },
  {
    key: "beacon_stale_after_s",
    label: "beacon_stale_after_s",
    description:
      "Seconds without a heartbeat or location before a beacon is flagged stale",
    unit: "s",
    min: 15,
    max: 3600,
  },
  {
    key: "flight_history_max_points",
    label: "flight_history_max_points",
    description:
      "Most points of the flight history carried in the snapshot (longer recordings are thinned)",
    unit: "",
    min: 100,
    max: 50000,
  },
  {
    key: "location_min_interval_ms",
    label: "location_min_interval_ms",
    description:
      "Least time between two accepted fixes from one beacon (0 disables)",
    unit: "ms",
    min: 0,
    max: 60000,
  },
  {
    key: "location_min_distance_m",
    label: "location_min_distance_m",
    description:
      "a fix that moved less than this from the last recorded one is shown live but not recorded (0 records every new position; a position already recorded for the event is never recorded twice)",
    unit: "m",
    min: 0,
    max: 10000,
    allowDecimal: true,
  },
];

export function specFor(key: string): SettingSpec | null {
  return SETTING_SPECS.find((s) => (s.key as string) === key) ?? null;
}

export function validateSettingValue(
  spec: SettingSpec,
  raw: string
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  const kind = spec.allowDecimal ? "number" : "whole number";
  const boundsMsg = `Must be a ${kind} between ${spec.min} and ${spec.max}`;
  if (trimmed === "") {
    return { ok: false, message: boundsMsg };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < spec.min || n > spec.max) {
    return { ok: false, message: boundsMsg };
  }
  if (!spec.allowDecimal && !Number.isInteger(n)) {
    return { ok: false, message: boundsMsg };
  }
  return { ok: true, value: n };
}
