import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";

// The style file check the theme editor runs before any request
// (admin.md 6.28): the API's shape rules of contracts 4.5 Themes (Style
// rules), so a refusal here reads the same as the API's `400
// validation_failed` at `style`, then, for MapLibre, the whole document
// through `validateStyleMin`, whose first problem is the reason.

export type Renderer = "google" | "maplibre";

export const GOOGLE_MAX_BYTES = 64 * 1024;
export const MAPLIBRE_MAX_BYTES = 512 * 1024;

const GOOGLE_KEYS = new Set(["featureType", "elementType", "stylers"]);
const SOURCE_TYPES: Record<string, string> = { basemap: "vector", terrain: "raster-dem" };
// Replaced by the API with its own glyph template and sprite base.
const API_OWNED = new Set(["glyphs", "sprite"]);

export type StyleCheck =
  | { ok: true; style: unknown; canonicalBytes: number; layerCount: number }
  | { ok: false; reason: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

// The path of the first string under `value` that starts with http, or
// null when there is none.
function httpString(value: unknown, path: string): string | null {
  if (typeof value === "string") return /^http/i.test(value) ? path : null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = httpString(value[i], `${path}[${i}]`);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (path === "" && API_OWNED.has(k)) continue;
      const hit = httpString(v, path === "" ? k : `${path}.${k}`);
      if (hit !== null) return hit;
    }
  }
  return null;
}

function checkGoogle(style: unknown): string | null {
  if (!Array.isArray(style)) {
    return "A Google Maps style is a JSON array of style rules.";
  }
  for (let i = 0; i < style.length; i += 1) {
    const rule: unknown = style[i];
    if (!isObject(rule)) return `Rule ${i + 1} is not an object.`;
    for (const k of Object.keys(rule)) {
      if (!GOOGLE_KEYS.has(k)) {
        return `Rule ${i + 1} has the key "${k}"; only featureType, elementType, and stylers are allowed.`;
      }
    }
  }
  return null;
}

function checkMaplibre(style: unknown): string | null {
  if (!isObject(style)) return "A MapLibre style is a JSON object.";
  if (style.version !== 8) return "The style's version must be 8.";
  const sources = style.sources;
  if (!isObject(sources) || !("basemap" in sources)) {
    return 'The style needs a "basemap" source.';
  }
  for (const [id, source] of Object.entries(sources)) {
    const type = SOURCE_TYPES[id];
    if (type === undefined) {
      return `The source "${id}" is not allowed; the sources are "basemap" and, optionally, "terrain".`;
    }
    if (!isObject(source) || source.type !== type) {
      return `The "${id}" source must have type "${type}".`;
    }
    if ("url" in source || "tiles" in source) {
      return `The "${id}" source must not have a url or tiles; the map supplies them.`;
    }
  }
  if (!Array.isArray(style.layers)) return "The style has no layers array.";
  for (const layer of style.layers as unknown[]) {
    if (!isObject(layer)) return "Every layer must be an object.";
    if (layer.type === "background") continue;
    const source = layer.source;
    if (typeof source !== "string" || !(source in SOURCE_TYPES)) {
      return `The layer "${String(layer.id)}" uses the source "${String(source)}"; layers draw from "basemap" or "terrain".`;
    }
  }
  const http = httpString(style, "");
  if (http !== null) {
    return `The string at ${http} starts with http; the style must not name a URL.`;
  }
  return null;
}

// Checks the text of a dropped style file for the renderer.
export function checkStyle(renderer: Renderer, text: string): StyleCheck {
  let style: unknown;
  try {
    style = JSON.parse(text);
  } catch {
    return { ok: false, reason: "The file is not valid JSON." };
  }
  const canonicalBytes = byteLength(JSON.stringify(style));
  const max = renderer === "google" ? GOOGLE_MAX_BYTES : MAPLIBRE_MAX_BYTES;
  const shape = renderer === "google" ? checkGoogle(style) : checkMaplibre(style);
  if (shape !== null) return { ok: false, reason: shape };
  if (canonicalBytes > max) {
    return { ok: false, reason: `The style is ${kb(canonicalBytes)}; the limit is ${kb(max)}.` };
  }
  if (renderer === "maplibre") {
    const problems = validateStyleMin(style as Parameters<typeof validateStyleMin>[0]);
    const first = problems[0];
    if (first) return { ok: false, reason: first.message };
  }
  const layerCount = Array.isArray(style)
    ? style.length
    : (style as { layers: unknown[] }).layers.length;
  return { ok: true, style, canonicalBytes, layerCount };
}
