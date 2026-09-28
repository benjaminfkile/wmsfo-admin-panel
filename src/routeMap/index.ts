// The route map module. style.ts and flavors.ts are copies of santa's
// src/routeMap (see README.md); this file is the panel's own entry point
// and reads the basemap base URL from the panel config
// (VITE_ROUTE_BASEMAP_URL through loadConfig).

import type { StyleSpecification } from "maplibre-gl";
import type { Config } from "../config";
import type { Appearance } from "./flavors";
import { buildStyle, type LatLng } from "./style";

export type { Appearance } from "./flavors";
export { FLAVORS, HILLSHADE_PAINTS, ROUTE_PALETTES } from "./flavors";
export {
  buildStyle,
  glyphsUrl,
  pathBounds,
  terrainUrl,
  tilesUrl,
  HILLSHADE_LAYER,
  OSM_ATTRIBUTION,
  TERRAIN_SOURCE,
  type LatLng,
} from "./style";

// The configured basemap base URL, or null when VITE_ROUTE_BASEMAP_URL is unset.
export function routeBasemapBase(config: Pick<Config, "routeBasemapUrl">): string | null {
  return config.routeBasemapUrl === "" ? null : config.routeBasemapUrl;
}

// The route map style over the configured basemap, with the hillshade
// over `<base>/terrain.pmtiles` when `terrain` is set. Throws when
// VITE_ROUTE_BASEMAP_URL is unset.
export function buildRouteMapStyle(
  config: Pick<Config, "routeBasemapUrl">,
  appearance: Appearance,
  path: readonly LatLng[],
  marks: readonly LatLng[] = [],
  terrain = false,
): StyleSpecification {
  const base = routeBasemapBase(config);
  if (base === null) throw new Error("VITE_ROUTE_BASEMAP_URL is not set");
  return buildStyle(appearance, base, path, marks, terrain);
}
