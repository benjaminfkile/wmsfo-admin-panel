// The `Display` primitive an icon or media reference can carry.
export type Display = {
  sizePx?: number;
  fit?: "contain" | "cover";
  shape?: "none" | "circle" | "rounded" | "square";
  paddingPx?: number;
  background?: "none" | "surface" | "muted" | "accent" | "night";
  shadow?: boolean;
  align?: "start" | "center" | "end";
};

export type DisplayKey = keyof Display;

const DISPLAY_KEYS: DisplayKey[] = [
  "sizePx",
  "fit",
  "shape",
  "paddingPx",
  "background",
  "shadow",
  "align",
];

// Reads a stored `display` value, keeping only the known keys that are
// set; anything that is not an object reads as empty.
export function readDisplay(raw: unknown): Display {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of DISPLAY_KEYS) {
    if (src[key] !== undefined && src[key] !== null) out[key] = src[key];
  }
  return out as Display;
}

// Returns a copy of `owner` with `display` set, or with the key removed
// when `display` is undefined.
export function withDisplay<T extends object>(
  owner: T,
  display: Display | undefined
): T {
  const rest = { ...(owner as Record<string, unknown>) };
  delete rest.display;
  return (display ? { ...rest, display } : rest) as T;
}
