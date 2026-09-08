// Client-side rules for the five settings keys (admin.md 6.9, 7.2).

export type SettingKey =
  | "poll_interval_ms"
  | "cookie_limit_per_person"
  | "sponsor_linger_ms_per_dollar"
  | "sponsor_linger_min_ms"
  | "beacon_stale_after_s";

export type SettingSpec = {
  key: SettingKey;
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
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
];

export function specFor(key: string): SettingSpec | null {
  return SETTING_SPECS.find((s) => (s.key as string) === key) ?? null;
}

export function validateSettingValue(
  spec: SettingSpec,
  raw: string
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return {
      ok: false,
      message: `Must be a whole number between ${spec.min} and ${spec.max}`,
    };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < spec.min || n > spec.max) {
    return {
      ok: false,
      message: `Must be a whole number between ${spec.min} and ${spec.max}`,
    };
  }
  return { ok: true, value: n };
}
