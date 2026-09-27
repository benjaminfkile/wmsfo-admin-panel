// Displayed times render in the viewer's browser zone (or an explicit
// `timeZone`, which tests pass) followed by that zone's short name, for
// example "CST". datetime-local inputs are in the browser zone, or in
// an explicit IANA zone through `wallTimeToUtc` and `utcToWallTime`;
// the helpers here convert back and forth without pulling in a full
// date library.

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

// The browser's IANA zone, for example "America/Denver".
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// Every IANA zone the runtime knows, sorted, with UTC and any `extra`
// zones (a stored zone, the browser zone) included when missing.
export function timeZoneOptions(...extra: Array<string | null | undefined>): string[] {
  const all = new Set<string>(
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : []
  );
  all.add("UTC");
  for (const z of extra) if (z) all.add(z);
  return [...all].sort();
}

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// Offset of `zone` from UTC at instant `ms`, in milliseconds, read
// from the zone's wall clock through formatToParts.
function zoneOffsetMs(ms: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const n = (t: Intl.DateTimeFormatPartTypes) => Number(part(parts, t));
  const asUtc = Date.UTC(
    n("year"),
    n("month") - 1,
    n("day"),
    n("hour") % 24,
    n("minute"),
    n("second")
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

// Read a "yyyy-MM-ddTHH:mm" wall time in `zone` and return the RFC 3339
// UTC instant; null for an empty or malformed value or an unknown
// zone. A wall time repeated when clocks fall back resolves to its
// first occurrence; a wall time skipped when clocks spring forward
// resolves to the same distance past the change (02:30 on a spring
// forward night reads as 03:30).
export function wallTimeToUtc(
  value: string | null | undefined,
  zone: string
): string | null {
  const m = value ? WALL_RE.exec(value) : null;
  if (!m) return null;
  const wall = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5])
  );
  if (Number.isNaN(wall)) return null;
  try {
    const day = 24 * 3600 * 1000;
    const before = zoneOffsetMs(wall - day, zone);
    const after = zoneOffsetMs(wall + day, zone);
    const valid = [before, after]
      .map((offset) => wall - offset)
      .filter((ms) => wall - zoneOffsetMs(ms, zone) === ms);
    const ms = valid.length > 0 ? Math.min(...valid) : wall - before;
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

// The "yyyy-MM-ddTHH:mm" wall time in `zone` of an RFC 3339 instant,
// for a datetime-local input; "" for null, invalid, or an unknown zone.
export function utcToWallTime(
  iso: string | null | undefined,
  zone: string
): string {
  const d = parse(iso);
  if (!d) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (t: Intl.DateTimeFormatPartTypes) => part(parts, t);
    const hour = String(Number(get("hour")) % 24).padStart(2, "0");
    return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
  } catch {
    return "";
  }
}

// Re-express a "yyyy-MM-ddTHH:mm" wall time in another zone, keeping the
// instant it names: "18:00 in America/Chicago" becomes "17:00 in
// America/Denver". A zone switch in a form goes through this so the
// stored instants never change silently; empty or unparseable input is
// returned as it is, so half-typed text survives a zone switch.
export function shiftWallZone(
  wall: string,
  fromZone: string,
  toZone: string
): string {
  if (!wall || fromZone === toZone) return wall;
  const iso = wallTimeToUtc(wall, fromZone);
  if (iso === null) return wall;
  const shifted = utcToWallTime(iso, toZone);
  return shifted || wall;
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
