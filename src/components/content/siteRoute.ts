import type { LatLng } from "../../routeMap";

// Site settings `route` (site-settings.schema.json): the site route, the
// one flight recording the route map, the tracker's flight history, and
// every poster draw, with its route map configuration. `routeId` null
// means no route; an absent `mapConfig` means every built-in default.

export interface SiteRouteValue {
  routeId: number | null;
  mapConfig?: unknown;
}

// The draft's `route` as the card edits it; an absent or malformed key
// reads as no route.
export function toSiteRoute(raw: unknown): SiteRouteValue {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { routeId: null };
  const obj = raw as Record<string, unknown>;
  const id = obj.routeId;
  const routeId = typeof id === "number" && Number.isInteger(id) && id >= 1 ? id : null;
  return obj.mapConfig === undefined ? { routeId } : { routeId, mapConfig: obj.mapConfig };
}

// `route` with `routeId` replaced; the map configuration stays.
export function withRouteId(raw: unknown, routeId: number | null): SiteRouteValue {
  return { ...toSiteRoute(raw), routeId };
}

// `route` with `mapConfig` replaced; null clears it to the defaults.
export function withMapConfig(raw: unknown, mapConfig: unknown): SiteRouteValue {
  return { ...toSiteRoute(raw), mapConfig };
}

// The document Save sends: a `route` object without a `routeId` (one the
// form filled in before the card wrote it) is left out, so the key stays
// absent until a recording or None is chosen.
export function withoutEmptyRoute(data: Record<string, unknown>): Record<string, unknown> {
  const route = data.route;
  if (route === undefined) return data;
  if (
    route !== null &&
    typeof route === "object" &&
    (route as Record<string, unknown>).routeId !== undefined
  ) {
    return data;
  }
  return Object.fromEntries(Object.entries(data).filter(([k]) => k !== "route"));
}

const PAD = 8;

// The SVG points of `path` fitted into the box: an equirectangular
// projection with the longitude scaled by the cosine of the middle
// latitude, north up, centred, with a small margin.
export function shapePoints(path: readonly LatLng[], width: number, height: number): string {
  if (path.length === 0) return "";
  const lats = path.map((p) => p.lat);
  const mid = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const xs = path.map((p) => p.lng * Math.cos(mid));
  const ys = path.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min(
    spanX > 0 ? (width - 2 * PAD) / spanX : Infinity,
    spanY > 0 ? (height - 2 * PAD) / spanY : Infinity,
  );
  const k = Number.isFinite(scale) ? scale : 1;
  const offX = (width - spanX * k) / 2;
  const offY = (height - spanY * k) / 2;
  return xs
    .map((x, i) => `${(offX + (x - minX) * k).toFixed(1)},${(offY + (ys[i]! - minY) * k).toFixed(1)}`)
    .join(" ");
}
