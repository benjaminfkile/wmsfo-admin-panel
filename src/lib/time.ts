// Displayed times render in the viewer's browser zone (or an explicit
// `timeZone`, which tests pass) followed by that zone's short name, for
// example "CST". datetime-local inputs are in the browser zone too; the
// helpers here convert back and forth without pulling in a full date
// library.

type Parts = Intl.DateTimeFormatPart[];

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function partsOf(
  d: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string | undefined
): Parts {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone,
    timeZoneName: "short",
  }).formatToParts(d);
}

function part(parts: Parts, type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

// "yyyy-MM-dd HH:mm:ss <zone>" for an RFC 3339 timestamp; "" for
// null or invalid.
export function formatStamp(
  iso: string | null | undefined,
  timeZone?: string
): string {
  const d = parse(iso);
  if (!d) return "";
  const parts = partsOf(
    d,
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    },
    timeZone
  );
  const get = (t: Intl.DateTimeFormatPartTypes) => part(parts, t);
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
    "minute"
  )}:${get("second")} ${get("timeZoneName")}`;
}

// "Dec 21, 2026 <zone>"; "" for null or invalid.
export function formatStampDate(
  iso: string | null | undefined,
  timeZone?: string
): string {
  const d = parse(iso);
  if (!d) return "";
  const parts = partsOf(
    d,
    { year: "numeric", month: "short", day: "numeric" },
    timeZone
  );
  const get = (t: Intl.DateTimeFormatPartTypes) => part(parts, t);
  return `${get("month")} ${get("day")}, ${get("year")} ${get("timeZoneName")}`;
}

// "HH:mm:ss <zone>"; "" for null or invalid.
export function formatStampTime(
  iso: string | null | undefined,
  timeZone?: string
): string {
  const d = parse(iso);
  if (!d) return "";
  const parts = partsOf(
    d,
    { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" },
    timeZone
  );
  const get = (t: Intl.DateTimeFormatPartTypes) => part(parts, t);
  return `${get("hour")}:${get("minute")}:${get("second")} ${get(
    "timeZoneName"
  )}`;
}

// Convert a UTC ISO string to a value suitable for <input
// type="datetime-local">. The browser interprets the string in the
// user's local zone; the helper leaves the wall-clock in the local
// zone unchanged from `new Date(iso).toLocaleString()`.
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Given a value from <input type="datetime-local"> (local time, minute
// precision) return an RFC 3339 UTC string.
export function fromLocalInputValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Difference between two RFC 3339 timestamps in whole seconds; null
// when either is missing or unparseable.
export function ageS(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((nowMs - t) / 1000);
}

// Compact "3s", "12m", "1h 5m", "2d" style age string. Negative ages
// (clock skew) render as "0s".
export function formatAgeS(seconds: number | null): string {
  if (seconds === null) return "";
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.floor(s / 86400)}d`;
}
