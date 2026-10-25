import { clampPoint, fitZoom, type Bbox } from "../bbox/bbox";

// An event's `trackerStartView` (contracts 1.3): where the tracker opens,
// the centre inside the event's box and the zoom an integer 3 to 18. Null
// means the tracker fits the whole box.
export type StartView = { center: { lat: number; lng: number }; zoom: number };

export const START_ZOOM_RANGE = { min: 3, max: 18 } as const;

type RawStartView = {
  center?: { lat?: number | string; lng?: number | string } | null;
  zoom?: number | string;
};

export function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export function clampStartZoom(z: number): number {
  return Math.min(START_ZOOM_RANGE.max, Math.max(START_ZOOM_RANGE.min, Math.round(z)));
}

// A start view from an API body (whose numbers may arrive as strings),
// keys in the contract's order, or null when it is absent or incomplete.
export function toStartView(raw: RawStartView | null | undefined): StartView | null {
  if (!raw || !raw.center) return null;
  const lat = Number(raw.center.lat);
  const lng = Number(raw.center.lng);
  const zoom = Number(raw.zoom);
  if (
    raw.center.lat === undefined ||
    raw.center.lng === undefined ||
    raw.zoom === undefined ||
    ![lat, lng, zoom].every(Number.isFinite)
  ) {
    return null;
  }
  return { center: { lat, lng }, zoom };
}

export function sameStartView(a: StartView | null, b: StartView | null): boolean {
  if (a === null || b === null) return a === b;
  return a.center.lat === b.center.lat && a.center.lng === b.center.lng && a.zoom === b.zoom;
}

// Whether the centre lies inside the box, edges included.
export function startViewInside(v: StartView, b: Bbox): boolean {
  const { lat, lng } = v.center;
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
}

// The view with its centre moved to the nearest point inside the box,
// to five decimals, and its zoom kept.
export function clampStartView(v: StartView, b: Bbox): StartView {
  const p = clampPoint(v.center, b);
  return { center: { lat: round5(p.lat), lng: round5(p.lng) }, zoom: v.zoom };
}

// The Google zoom at which the box fills a viewport of the given size,
// whole, between 3 and 18: the minimum zoom of the start view map. Google
// draws a 256 px world at zoom 0, one zoom above `fitZoom`'s 512 px.
export function startMinZoom(b: Bbox, width: number, height: number): number {
  const z = fitZoom(b, width, height) + 1;
  if (!Number.isFinite(z)) return START_ZOOM_RANGE.min;
  return Math.min(START_ZOOM_RANGE.max, Math.max(START_ZOOM_RANGE.min, Math.floor(z)));
}

// The caption under the start view map.
export function startViewCaption(v: StartView | null): string {
  if (v === null) return "Whole area: the tracker opens showing the whole box.";
  return `Centre ${v.center.lat.toFixed(5)}, ${v.center.lng.toFixed(5)} at zoom ${v.zoom}`;
}
