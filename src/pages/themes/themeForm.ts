import type { Chrome, Overlay, ThemeBody } from "../../api/resources/themes";
import type { TrackerTheme } from "../../api/types";
import { ApiError } from "../../api/errors";
import seed from "../../../contracts/fixtures/themes/seed.json";
import { CONTRAST_PAIRS, contrastRatio, isHexColour, passes } from "./contrast";
import type { Renderer } from "./styleCheck";

// The theme editor's form (admin.md 6.28, 7.2): its state, the rules, the
// create body and the edit patch, the next free `sortOrder`, the default
// flag captions, and where a server error lands.

export const CHROME_KEYS = ["bg", "fg", "text", "tile", "tileFg", "panel", "accent"] as const;
export const OVERLAY_COLOUR_KEYS = [
  "routeColor",
  "arrowColor",
  "timeLabelBg",
  "timeLabelFg",
  "userColor",
] as const;
export const OVERLAY_OPACITY_KEYS = ["routeOpacity", "timeLabelOpacity"] as const;

export type ChromeKey = (typeof CHROME_KEYS)[number];
export type OverlayColourKey = (typeof OVERLAY_COLOUR_KEYS)[number];
export type OverlayOpacityKey = (typeof OVERLAY_OPACITY_KEYS)[number];

export const CHROME_LABELS: Record<ChromeKey, string> = {
  bg: "Background",
  fg: "Secondary text",
  text: "Text",
  tile: "Tile",
  tileFg: "Tile text",
  panel: "Panel",
  accent: "Accent",
};

export const OVERLAY_LABELS: Record<OverlayColourKey | OverlayOpacityKey, string> = {
  routeColor: "Route",
  arrowColor: "Arrows",
  timeLabelBg: "Time label background",
  timeLabelFg: "Time label text",
  userColor: "User marker",
  routeOpacity: "Route opacity",
  timeLabelOpacity: "Time label opacity",
};

export const KEY_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
export const NAME_MAX = 60;

export const KEY_HELPER =
  "What a visitor's saved choice names. Changing it sends those visitors back to the default.";
export const KEY_RULE =
  "2 to 40 characters: lowercase letters, digits, and hyphens, starting with a letter";
export const HEX_RULE = "Use #rrggbb or #rrggbbaa";
export const OPACITY_RULE = "Between 0 and 1";
export const CONTRAST_RULE = "4.5:1 or better is required";
export const STYLE_REQUIRED = "Choose a style file";

export const RENDERER_LABELS: Record<Renderer, string> = {
  google: "Google Maps",
  maplibre: "MapLibre",
};

export type ThemeForm = {
  renderer: Renderer;
  key: string;
  name: string;
  chrome: Chrome;
  // The two opacities are held as typed text.
  overlay: Record<OverlayColourKey, string> & Record<OverlayOpacityKey, string>;
  thumbnailMediaId: string | null;
  defaultLight: boolean;
  defaultDark: boolean;
};

type SeedRow = (typeof seed)[number];

function seedRow(key: string): SeedRow {
  return seed.find((t) => t.key === key)!;
}

// The colours a new theme starts from: the light seed of the renderer.
function starterColours(renderer: Renderer): { chrome: Chrome; overlay: Overlay } {
  const row = seedRow(renderer === "google" ? "standard" : "route-light");
  return { chrome: { ...row.chrome }, overlay: { ...row.overlay } };
}

function overlayText(o: Overlay): ThemeForm["overlay"] {
  return {
    routeColor: o.routeColor,
    arrowColor: o.arrowColor,
    timeLabelBg: o.timeLabelBg,
    timeLabelFg: o.timeLabelFg,
    userColor: o.userColor,
    routeOpacity: String(o.routeOpacity),
    timeLabelOpacity: String(o.timeLabelOpacity),
  };
}

export function initialForm(theme: TrackerTheme | null, renderer: Renderer = "maplibre"): ThemeForm {
  if (theme === null) {
    const c = starterColours(renderer);
    return {
      renderer,
      key: "",
      name: "",
      chrome: c.chrome,
      overlay: overlayText(c.overlay),
      thumbnailMediaId: null,
      defaultLight: false,
      defaultDark: false,
    };
  }
  const r: Renderer = theme.renderer === "google" ? "google" : "maplibre";
  const c = starterColours(r);
  return {
    renderer: r,
    key: theme.key ?? "",
    name: theme.name ?? "",
    chrome: { ...c.chrome, ...(theme.chrome as Partial<Chrome> | undefined) },
    overlay: overlayText({ ...c.overlay, ...(theme.overlay as Partial<Overlay> | undefined) }),
    thumbnailMediaId: theme.thumbnailMediaId ?? null,
    defaultLight: theme.defaultLightMode === true,
    defaultDark: theme.defaultDarkMode === true,
  };
}

function opacityValue(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

// The overlay as numbers, with an opacity that does not parse held at 1,
// for the live preview.
export function previewOverlay(f: ThemeForm["overlay"]): Overlay {
  return {
    routeColor: f.routeColor,
    arrowColor: f.arrowColor,
    timeLabelBg: f.timeLabelBg,
    timeLabelFg: f.timeLabelFg,
    userColor: f.userColor,
    routeOpacity: opacityValue(f.routeOpacity) ?? 1,
    timeLabelOpacity: opacityValue(f.timeLabelOpacity) ?? 1,
  };
}

export function toOverlay(f: ThemeForm["overlay"]): Overlay {
  return {
    routeColor: f.routeColor.trim(),
    routeOpacity: Number(f.routeOpacity),
    arrowColor: f.arrowColor.trim(),
    timeLabelBg: f.timeLabelBg.trim(),
    timeLabelFg: f.timeLabelFg.trim(),
    timeLabelOpacity: Number(f.timeLabelOpacity),
    userColor: f.userColor.trim(),
  };
}

export function toChrome(c: Chrome): Chrome {
  return {
    bg: c.bg.trim(),
    fg: c.fg.trim(),
    text: c.text.trim(),
    tile: c.tile.trim(),
    tileFg: c.tileFg.trim(),
    panel: c.panel.trim(),
    accent: c.accent.trim(),
  };
}

// Field errors by path (`key`, `name`, `style`, `chrome.text`, ...).
export type FieldErrors = Record<string, string>;

export function keyError(key: string): string | null {
  return KEY_PATTERN.test(key.trim()) ? null : KEY_RULE;
}

export function nameError(name: string): string | null {
  const n = name.trim();
  if (n.length === 0) return "Name is required";
  if (n.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer`;
  return null;
}

// Whether every contrast pair passes; while one fails Save is blocked.
export function contrastPasses(chrome: Chrome): boolean {
  return CONTRAST_PAIRS.every((p) => passes(contrastRatio(chrome[p.fg], chrome[p.bg])));
}

// The rules of 7.2 over the form. `hasStyle` is whether a style is set
// (a valid dropped file, or the saved style on an edit).
export function validate(f: ThemeForm, hasStyle: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const k = keyError(f.key);
  if (k) errors.key = k;
  const n = nameError(f.name);
  if (n) errors.name = n;
  if (!hasStyle) errors.style = STYLE_REQUIRED;
  for (const key of CHROME_KEYS) {
    if (!isHexColour(f.chrome[key].trim())) errors[`chrome.${key}`] = HEX_RULE;
  }
  for (const p of CONTRAST_PAIRS) {
    if (errors[`chrome.${p.fg}`] || errors[`chrome.${p.bg}`]) continue;
    if (!passes(contrastRatio(f.chrome[p.fg].trim(), f.chrome[p.bg].trim()))) {
      errors[`chrome.${p.fg}`] = CONTRAST_RULE;
    }
  }
  for (const key of OVERLAY_COLOUR_KEYS) {
    if (!isHexColour(f.overlay[key].trim())) errors[`overlay.${key}`] = HEX_RULE;
  }
  for (const key of OVERLAY_OPACITY_KEYS) {
    if (opacityValue(f.overlay[key]) === null) errors[`overlay.${key}`] = OPACITY_RULE;
  }
  return errors;
}

// The next free position in the renderer's group: 10 past the highest.
export function nextSortOrder(themes: readonly TrackerTheme[], renderer: Renderer): number {
  const values = themes
    .filter((t) => t.renderer === renderer)
    .map((t) => Number(t.sortOrder ?? 0));
  return values.length === 0 ? 10 : Math.max(...values) + 10;
}

export function createBody(f: ThemeForm, style: unknown, sortOrder: number): ThemeBody {
  return {
    renderer: f.renderer,
    key: f.key.trim(),
    name: f.name.trim(),
    sortOrder,
    style,
    chrome: toChrome(f.chrome),
    overlay: toOverlay(f.overlay),
    thumbnailMediaId: f.thumbnailMediaId,
  };
}

// The create body as multipart: the scalar fields as text, `chrome` and
// `overlay` as JSON, and `style` as a file part holding the checked
// document (`styleCheck.ts`, which has dropped what the API and the map
// own) under the dropped file's name.
export function createForm(body: ThemeBody, fileName: string): FormData {
  const form = new FormData();
  form.append("renderer", body.renderer);
  form.append("key", body.key);
  form.append("name", body.name);
  form.append("sortOrder", String(body.sortOrder));
  form.append("chrome", JSON.stringify(body.chrome));
  form.append("overlay", JSON.stringify(body.overlay));
  if (body.thumbnailMediaId !== null) form.append("thumbnailMediaId", body.thumbnailMediaId);
  const part = new File([JSON.stringify(body.style)], fileName, { type: "application/json" });
  form.append("style", part, fileName);
  return form;
}

function sameObject(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

export type ThemePatch = Partial<Omit<ThemeBody, "renderer">>;

// The edit patch: only the fields that differ from the form it opened
// with, and `style` only when a new file was dropped.
export function editPatch(start: ThemeForm, f: ThemeForm, newStyle: unknown): ThemePatch {
  const patch: ThemePatch = {};
  if (f.key.trim() !== start.key) patch.key = f.key.trim();
  if (f.name.trim() !== start.name) patch.name = f.name.trim();
  if (newStyle !== undefined) patch.style = newStyle;
  const chrome = toChrome(f.chrome);
  if (!sameObject(chrome, toChrome(start.chrome))) patch.chrome = chrome;
  const overlay = toOverlay(f.overlay);
  if (!sameObject(overlay, toOverlay(start.overlay))) patch.overlay = overlay;
  if (f.thumbnailMediaId !== start.thumbnailMediaId) patch.thumbnailMediaId = f.thumbnailMediaId;
  return patch;
}

// The default flags to send after the write: only the ones flipped.
export function defaultFlips(
  start: ThemeForm | null,
  f: ThemeForm,
): { light?: boolean; dark?: boolean } | null {
  const light = start?.defaultLight ?? false;
  const dark = start?.defaultDark ?? false;
  const body: { light?: boolean; dark?: boolean } = {};
  if (f.defaultLight !== light) body.light = f.defaultLight;
  if (f.defaultDark !== dark) body.dark = f.defaultDark;
  return Object.keys(body).length === 0 ? null : body;
}

// "Replaces <name> as the <light or dark> default" while the switch would
// take the flag from another theme of the renderer, or null.
export function replacesCaption(
  themes: readonly TrackerTheme[],
  self: TrackerTheme | null,
  renderer: Renderer,
  mode: "light" | "dark",
  on: boolean,
): string | null {
  if (!on) return null;
  const holder = themes.find(
    (t) =>
      t.renderer === renderer &&
      (self === null || Number(t.id) !== Number(self.id)) &&
      (mode === "light" ? t.defaultLightMode === true : t.defaultDarkMode === true),
  );
  return holder ? `Replaces ${holder.name ?? "another theme"} as the ${mode} default` : null;
}

// A server path (`chrome.text`, `/chrome/text`) as the form's field path.
function fieldPath(path: string): string {
  return path.replace(/^\//, "").replace(/\//g, ".");
}

// Where a failed write lands: `409` (and a `400` at `key`) on Key, the
// other `400 validation_failed` fields on the field their path names.
export function serverFieldErrors(error: unknown, renderer: Renderer): FieldErrors {
  if (!(error instanceof ApiError)) return {};
  const duplicate = `A ${RENDERER_LABELS[renderer]} theme with this key exists`;
  if (error.status === 409 && error.code !== "media_not_ready") return { key: duplicate };
  if (error.status !== 400) return {};
  const out: FieldErrors = {};
  for (const [path, message] of Object.entries(error.fields)) {
    out[fieldPath(path)] = message;
  }
  return out;
}
