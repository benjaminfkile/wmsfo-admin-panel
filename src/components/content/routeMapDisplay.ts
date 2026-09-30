// The route map display knobs (`display` of RouteMapConfig in
// primitives.schema.json), set per event in its `routeMapConfig`. Every
// key is optional; the site resolves each key on its own, the stored
// value first, then the built-in default below.
export type RouteMapDisplayKey =
  | "timeLabelIntervalMinutes"
  | "arrows"
  | "arrowSize"
  | "routeWidth"
  | "labelSize";

export type RouteMapDisplayValue = number | boolean | string;

export type RouteMapDisplay = Partial<Record<RouteMapDisplayKey, RouteMapDisplayValue>>;

export const ROUTE_MAP_DISPLAY_KEYS: RouteMapDisplayKey[] = [
  "timeLabelIntervalMinutes",
  "arrows",
  "arrowSize",
  "routeWidth",
  "labelSize",
];

// The values the site uses where no level sets a key.
export const ROUTE_MAP_DEFAULTS: Record<RouteMapDisplayKey, RouteMapDisplayValue> = {
  timeLabelIntervalMinutes: 15,
  arrows: true,
  arrowSize: "medium",
  routeWidth: "normal",
  labelSize: "medium",
};

// The contract's allowed values per key, in display order.
export const ROUTE_MAP_CHOICES: Record<RouteMapDisplayKey, RouteMapDisplayValue[]> = {
  timeLabelIntervalMinutes: [0, 5, 10, 15, 30],
  arrows: [true, false],
  arrowSize: ["small", "medium", "large", "xlarge"],
  routeWidth: ["thin", "normal", "thick", "xthick"],
  labelSize: ["small", "medium", "large"],
};

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

// A stored key's value when it is one of the contract's values for that
// key, otherwise undefined (read as unset).
export function readDisplayKey(
  owner: unknown,
  key: RouteMapDisplayKey
): RouteMapDisplayValue | undefined {
  const raw = asRecord(owner)[key];
  return ROUTE_MAP_CHOICES[key].includes(raw as RouteMapDisplayValue)
    ? (raw as RouteMapDisplayValue)
    : undefined;
}

// The value a key resolves to from the given levels, the first level
// first, falling back to the built-in default.
export function resolveDisplayKey(
  levels: unknown[],
  key: RouteMapDisplayKey
): RouteMapDisplayValue {
  for (const level of levels) {
    const v = readDisplayKey(level, key);
    if (v !== undefined) return v;
  }
  return ROUTE_MAP_DEFAULTS[key];
}

// Returns a copy of `owner` with `key` set to `next`, or with the key
// removed when `next` is undefined. An object left with no keys comes
// back as undefined, so an untouched block is never written.
export function withDisplayKey(
  owner: unknown,
  key: RouteMapDisplayKey,
  next: RouteMapDisplayValue | undefined
): RouteMapDisplay | undefined {
  const rest = { ...asRecord(owner) };
  delete rest[key];
  const out = next === undefined ? rest : { ...rest, [key]: next };
  return Object.keys(out).length === 0 ? undefined : (out as RouteMapDisplay);
}
