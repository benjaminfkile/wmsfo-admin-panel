// The route map module's entry point (admin.md 2.11). Every map the panel
// draws is a tracker theme body over a tracker map row (themeStyle.ts) or,
// for the theme preview, over the configured dev basemap (VITE_ROUTE_BASEMAP_URL through loadConfig); routeLayers.ts adds
// the panel's own route layers over either.

import type { StyleSpecification } from "maplibre-gl";
import type { Config } from "../config";
import { withSources } from "./themeStyle";

export {
  makeRouteArrowImage,
  pathBounds,
  themeOverlay,
  withRouteLayers,
  withoutDetails,
  ARROWS_LAYER,
  DETAIL_LAYERS,
  OSM_ATTRIBUTION,
  POSTER_LABELS,
  ROUTE_ARROW_ICON,
  TIME_LABEL_DOTS_LAYER,
  TIME_LABELS_LAYER,
  TIME_LABELS_SOURCE,
  type LatLng,
  type RouteArrowImage,
  type RouteLayerOptions,
  type StyleDetails,
  type TimeLabel,
} from "./routeLayers";

// The configured basemap base URL, or null when VITE_ROUTE_BASEMAP_URL is unset.
export function routeBasemapBase(config: Pick<Config, "routeBasemapUrl">): string | null {
  return config.routeBasemapUrl === "" ? null : config.routeBasemapUrl;
}

// The glyph URL template under a dev basemap base.
export function glyphsUrl(base: string): string {
  return `${base}/glyphs/{fontstack}/{range}.pbf`;
}

// A theme body pointed at the configured basemap instead of a map row:
// `basemap` at `<base>/tiles.pmtiles` and `terrain` at
// `<base>/terrain.pmtiles`. The theme preview draws with it. Throws when VITE_ROUTE_BASEMAP_URL is unset.
export function applyDevBasemap(
  style: StyleSpecification,
  config: Pick<Config, "routeBasemapUrl">,
): StyleSpecification {
  const base = routeBasemapBase(config);
  if (base === null) throw new Error("VITE_ROUTE_BASEMAP_URL is not set");
  return withSources(style, `${base}/tiles.pmtiles`, `${base}/terrain.pmtiles`);
}

// A theme body ready to open in Maputnik: `glyphs` at the glyph template
// under the configured basemap when the body names none, `basemap` at
// `pmtiles://<base>/tiles.pmtiles`, and `terrain` at
// `pmtiles://<base>/terrain.pmtiles`. The starter style and the theme
// downloads serve it. With VITE_ROUTE_BASEMAP_URL unset the body comes
// back unchanged.
export function forMaputnik(
  style: StyleSpecification,
  config: Pick<Config, "routeBasemapUrl">,
): StyleSpecification {
  const base = routeBasemapBase(config);
  if (base === null) return style;
  const pointed = withSources(style, `${base}/tiles.pmtiles`, `${base}/terrain.pmtiles`);
  return { ...pointed, glyphs: style.glyphs ?? glyphsUrl(base) };
}
