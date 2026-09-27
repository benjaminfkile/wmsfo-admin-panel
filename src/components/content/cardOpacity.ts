// The card opacity pair a site settings theme and a section's
// `Presentation` carry: integers 0 to 100, absent when unset.
export type CardOpacityKey = "cardOpacityLight" | "cardOpacityDark";

export const CARD_OPACITY_KEYS: CardOpacityKey[] = [
  "cardOpacityLight",
  "cardOpacityDark",
];

export type CardOpacityValue = Partial<Record<CardOpacityKey, number>>;

export const CARD_OPACITY_MIN = 0;
export const CARD_OPACITY_MAX = 100;

// Clamps an opacity to 0 to 100.
export function clampOpacity(n: number): number {
  return Math.min(CARD_OPACITY_MAX, Math.max(CARD_OPACITY_MIN, n));
}

// Reads a stored opacity: a finite number (or numeric string) rounded to
// an integer, otherwise undefined.
export function readOpacity(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

// Returns a copy of `owner` with `key` set to `next`, or with the key
// removed when `next` is undefined.
export function withOpacity<T extends object>(
  owner: T,
  key: CardOpacityKey,
  next: number | undefined
): T {
  const rest = { ...(owner as Record<string, unknown>) };
  delete rest[key];
  return (next === undefined ? rest : { ...rest, [key]: next }) as T;
}
