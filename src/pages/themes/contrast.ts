// The chrome contrast rule (admin.md 6.28, contracts 4.5 Themes): WCAG
// relative luminance, with the alpha of an `#rrggbbaa` colour composited
// over the other colour of the pair. The API applies the same formula at
// write to `chrome.text` on `chrome.bg` and `chrome.tileFg` on
// `chrome.tile`.

export const HEX_COLOUR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export const MIN_CONTRAST = 4.5;

export type Rgba = { r: number; g: number; b: number; a: number };

// Whether the text is `#rrggbb` or `#rrggbbaa`.
export function isHexColour(value: string): boolean {
  return HEX_COLOUR.test(value);
}

// The channels of `#rrggbb` or `#rrggbbaa` (0 to 255, alpha 0 to 1), or
// null for any other text.
export function parseHex(value: string): Rgba | null {
  if (!isHexColour(value)) return null;
  const n = (i: number) => parseInt(value.slice(i, i + 2), 16);
  return {
    r: n(1),
    g: n(3),
    b: n(5),
    a: value.length === 9 ? n(7) / 255 : 1,
  };
}

// The colour drawn when `top` is painted over the opaque `under`.
export function composite(top: Rgba, under: Rgba): Rgba {
  const mix = (t: number, u: number) => t * top.a + u * (1 - top.a);
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

// WCAG relative luminance of the colour's opaque channels.
export function relativeLuminance(c: Rgba): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

// The contrast ratio of `fg` on `bg` (1 to 21), or null when either is
// not a hex colour. A translucent colour is composited over the other
// one (the other taken as opaque) before the luminances are compared.
export function contrastRatio(fg: string, bg: string): number | null {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return null;
  const opaque = (c: Rgba): Rgba => ({ ...c, a: 1 });
  const front = f.a < 1 ? composite(f, opaque(b)) : f;
  const back = b.a < 1 ? composite(b, opaque(f)) : b;
  const l1 = relativeLuminance(front);
  const l2 = relativeLuminance(back);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// The ratio as the readout shows it, two decimals truncated so a value
// just under the minimum never reads as 4.50.
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

export type ContrastPair = {
  label: string;
  fg: "text" | "tileFg";
  bg: "bg" | "tile";
};

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { label: "Text on background", fg: "text", bg: "bg" },
  { label: "Tile text on tile", fg: "tileFg", bg: "tile" },
];

export function passes(ratio: number | null): boolean {
  return ratio !== null && ratio >= MIN_CONTRAST;
}
