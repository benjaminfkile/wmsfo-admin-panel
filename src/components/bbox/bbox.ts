import type { Bbox } from "../../validation/bbox";

export {
  BBOX_SIDES,
  bboxValid,
  validateBbox,
  type Bbox,
  type BboxErrors,
  type BboxSide,
} from "../../validation/bbox";

// The built-in box the API falls back to while the site settings carry no
// `tracker` key (contracts 1.3a).
export const MISSOULA_VALLEY_BBOX: Bbox = {
  west: -114.75,
  south: 46.35,
  east: -113.3,
  north: 47.25,
};

// The viewports the minimum zoom caption reads: a phone and a desktop.
export const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
export const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;

export const EXPORT_MAX_ZOOM = 15;
export const EXPORT_TERRAIN_MAX_ZOOM = 15;
export const MAX_ZOOM_RANGE = { min: 8, max: 15 } as const;
export const TERRAIN_MAX_ZOOM_RANGE = { min: 8, max: 15 } as const;

// MapLibre draws a 512 px world at zoom 0.
const TILE_SIZE = 512;

type RawBbox = {
  west?: number | string;
  south?: number | string;
  east?: number | string;
  north?: number | string;
};

// A box from an API body (whose numbers may arrive as strings), or null
// when any side is missing or not a number.
export function toBbox(raw: RawBbox | null | undefined): Bbox | null {
  if (!raw) return null;
  const parts = [raw.west, raw.south, raw.east, raw.north];
  if (parts.some((v) => v === undefined || v === "" || !Number.isFinite(Number(v)))) return null;
  return {
    west: Number(raw.west),
    south: Number(raw.south),
    east: Number(raw.east),
    north: Number(raw.north),
  };
}

export function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

export function roundBbox(b: Bbox): Bbox {
  return { west: round4(b.west), south: round4(b.south), east: round4(b.east), north: round4(b.north) };
}

export function sameBbox(a: Bbox, b: Bbox): boolean {
  return a.west === b.west && a.south === b.south && a.east === b.east && a.north === b.north;
}

// Whether `outer` holds every point of `inner`.
export function bboxContains(outer: Bbox, inner: Bbox): boolean {
  return (
    outer.west <= inner.west &&
    outer.south <= inner.south &&
    outer.east >= inner.east &&
    outer.north >= inner.north
  );
}

// The site settings draft's `tracker.defaultBbox`, or the Missoula valley
// box while the draft has no usable `tracker` key.
export function siteDefaultBbox(data: unknown): Bbox {
  if (data && typeof data === "object") {
    const tracker = (data as Record<string, unknown>).tracker;
    if (tracker && typeof tracker === "object") {
      const b = toBbox((tracker as { defaultBbox?: RawBbox }).defaultBbox);
      if (b) return b;
    }
  }
  return MISSOULA_VALLEY_BBOX;
}

function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
}

// The zoom at which the box fills a viewport of the given size on the
// Mercator projection: the larger of the zooms that fit the box's width
// and its height to the viewport, so no part of the viewport lies outside
// the box. Both site renderers lock their minimum zoom to it.
export function fitZoom(b: Bbox, width: number, height: number): number {
  const lonFraction = (b.east - b.west) / 360;
  const latFraction = mercatorY(b.north) - mercatorY(b.south);
  const zx = Math.log2(width / (TILE_SIZE * lonFraction));
  const zy = Math.log2(height / (TILE_SIZE * latFraction));
  return Math.max(zx, zy);
}

// "Minimum zoom: <phone> on a phone, <desktop> on a desktop", one decimal.
export function minZoomCaption(b: Bbox): string {
  const z = (w: number, h: number) => fitZoom(b, w, h).toFixed(1);
  return `Minimum zoom: ${z(PHONE_VIEWPORT.width, PHONE_VIEWPORT.height)} on a phone, ${z(
    DESKTOP_VIEWPORT.width,
    DESKTOP_VIEWPORT.height,
  )} on a desktop`;
}

export type BboxExport = {
  name: string;
  bbox: Bbox;
  maxZoom: number;
  terrainMaxZoom: number;
};

// The document the tile CLI's `--bbox-file` reads.
export function exportDocument(
  name: string,
  bbox: Bbox,
  maxZoom: number = EXPORT_MAX_ZOOM,
  terrainMaxZoom: number = EXPORT_TERRAIN_MAX_ZOOM,
): BboxExport {
  return { name, bbox: roundBbox(bbox), maxZoom, terrainMaxZoom };
}

// "<name>.json", with the characters a file name cannot hold replaced.
export function exportFileName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|]+/g, " ").trim();
  return `${safe === "" ? "area" : safe}.json`;
}

// A zoom field's value clamped to its range, or the fallback when the
// text is not a whole number.
export function clampZoom(text: string, range: { min: number; max: number }, fallback: number): number {
  const n = Number(text);
  if (text.trim() === "" || !Number.isInteger(n)) return fallback;
  return Math.min(range.max, Math.max(range.min, n));
}
