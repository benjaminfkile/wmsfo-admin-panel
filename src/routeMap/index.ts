// The route map module. style.ts and flavors.ts are copies of santa's
// src/routeMap (see README.md); this file is the panel's own entry point
// and reads the basemap base URL from the panel config
// (VITE_ROUTE_BASEMAP_URL through loadConfig).

import type { StyleSpecification } from "maplibre-gl";
import type { Config } from "../config";
import type { Appearance } from "./flavors";
import { buildStyle, type LatLng, type StyleOptions } from "./style";
import { withSources } from "./themeStyle";

export type { Appearance } from "./flavors";
export { FLAVORS, HILLSHADE_PAINTS, ROUTE_PALETTES } from "./flavors";
export {
  buildStyle,
  glyphsUrl,
  makeRouteArrowImage,
  pathBounds,
  terrainUrl,
  tilesUrl,
  ARROWS_LAYER,
  DETAIL_LAYERS,
  HILLSHADE_LAYER,
  OSM_ATTRIBUTION,
  ROUTE_ARROW_ICON,
  TERRAIN_SOURCE,
  TIME_LABEL_DOTS_LAYER,
  TIME_LABELS_LAYER,
  TIME_LABELS_SOURCE,
  type LatLng,
  type RouteArrowImage,
  type StyleDetails,
  type StyleOptions,
  type TimeLabel,
} from "./style";

// The configured basemap base URL, or null when VITE_ROUTE_BASEMAP_URL is unset.
export function routeBasemapBase(config: Pick<Config, "routeBasemapUrl">): string | null {
  return config.routeBasemapUrl === "" ? null : config.routeBasemapUrl;
}

// A theme body pointed at the configured basemap instead of a map row:
// `basemap` at `<base>/tiles.pmtiles` and `terrain` at
// `<base>/terrain.pmtiles`. The theme preview and the box editors draw
// with it. Throws when VITE_ROUTE_BASEMAP_URL is unset.
export function applyDevBasemap(
  style: StyleSpecification,
  config: Pick<Config, "routeBasemapUrl">,
): StyleSpecification {
  const base = routeBasemapBase(config);
  if (base === null) throw new Error("VITE_ROUTE_BASEMAP_URL is not set");
  return withSources(style, `${base}/tiles.pmtiles`, `${base}/terrain.pmtiles`);
}

// The route map style over the configured basemap, with the hillshade
// over `<base>/terrain.pmtiles` when `terrain` is set and the route
// colour, arrows, time labels, and basemap details of `options`. Throws when
// VITE_ROUTE_BASEMAP_URL is unset.
export function buildRouteMapStyle(
  config: Pick<Config, "routeBasemapUrl">,
  appearance: Appearance,
  path: readonly LatLng[],
  marks: readonly LatLng[] = [],
  terrain = false,
  options: StyleOptions = {},
): StyleSpecification {
  const base = routeBasemapBase(config);
  if (base === null) throw new Error("VITE_ROUTE_BASEMAP_URL is not set");
  return buildStyle(appearance, base, path, marks, terrain, options);
}
