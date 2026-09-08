// All displayed times are Mountain (America/Denver) labelled "MT".
// datetime-local inputs are in the browser zone; the helper here
// converts back and forth without pulling in a full date library.

const TZ = "America/Denver";
const MT_LABEL = "MT";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "short",
  day: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// Format an RFC 3339 timestamp as Mountain time with a "MT" suffix.
// Returns "" for null/invalid.
export function formatMt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
    "minute"
  )}:${get("second")} ${MT_LABEL}`;
}

export function formatMtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${dateFmt.format(d)} ${MT_LABEL}`;
}

export function formatMtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${timeFmt.format(d)} ${MT_LABEL}`;
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
