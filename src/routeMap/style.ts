// docs/site.md section 8.9. Builds the MapLibre style of the route map for
// one appearance: the @protomaps/basemaps layers over the CDN basemap in
// that appearance's flavor, then the route path as a line, the timeline
// marks as small dots on it, and the start and end markers as circles.
// Both appearances share every source and
// layer id, so a switch between them is a paint-only style diff.

import { layers } from "@protomaps/basemaps";
import type {
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { FLAVORS, ROUTE_PALETTES, type Appearance } from "./flavors";

export type LatLng = { lat: number; lng: number };

export const BASEMAP_SOURCE = "protomaps";
export const ROUTE_SOURCE = "route";
export const ENDS_SOURCE = "route-ends";
export const MARKS_SOURCE = "route-marks";
export const ROUTE_LAYER = "route-line";
export const MARKS_LAYER = "route-marks";
export const ENDS_LAYER = "route-ends";

export const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

// Symbol layers that need the basemap sprite, which the CDN basemap does
// not carry: one-way arrows and road shields are left out, and the
// remaining layers keep their text without the icon.
const SPRITE_ONLY_LAYERS = new Set(["roads_oneway", "roads_shields"]);

export function tilesUrl(base: string): string {
  return `${base}/tiles.pmtiles`;
}

export function glyphsUrl(base: string): string {
  return `${base}/glyphs/{fontstack}/{range}.pbf`;
}

// [[west, south], [east, north]] around the path, or null when it is empty.
export function pathBounds(path: readonly LatLng[]): [[number, number], [number, number]] | null {
  if (path.length === 0) return null;
  let west = path[0].lng;
  let east = path[0].lng;
  let south = path[0].lat;
  let north = path[0].lat;
  for (const p of path) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  return [[west, south], [east, north]];
}

function basemapLayers(appearance: Appearance): LayerSpecification[] {
  return layers(BASEMAP_SOURCE, FLAVORS[appearance], { lang: "en" })
    .filter((layer) => !SPRITE_ONLY_LAYERS.has(layer.id))
    .map((layer) => {
      if (layer.type !== "symbol" || layer.layout === undefined) return layer;
      const layout = Object.fromEntries(
        Object.entries(layer.layout).filter(([key]) => !key.startsWith("icon-")),
      );
      return { ...layer, layout } as LayerSpecification;
    });
}

export function buildStyle(
  appearance: Appearance,
  base: string,
  path: readonly LatLng[],
  marks: readonly LatLng[] = [],
): StyleSpecification {
  const palette = ROUTE_PALETTES[appearance];
  const coordinates = path.map((p) => [p.lng, p.lat]);
  const ends = path.length === 0
    ? []
    : [
        { end: "start", point: path[0] },
        { end: "end", point: path[path.length - 1] },
      ];
  return {
    version: 8,
    glyphs: glyphsUrl(base),
    sources: {
      [BASEMAP_SOURCE]: {
        type: "vector",
        url: `pmtiles://${tilesUrl(base)}`,
        attribution: OSM_ATTRIBUTION,
      },
      [ROUTE_SOURCE]: {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        },
      },
      [MARKS_SOURCE]: {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: marks.map((point) => ({
            type: "Feature" as const,
            properties: {},
            geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
          })),
        },
      },
      [ENDS_SOURCE]: {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: ends.map(({ end, point }) => ({
            type: "Feature" as const,
            properties: { end },
            geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
          })),
        },
      },
    },
    layers: [
      ...basemapLayers(appearance),
      {
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": palette.routeColor,
          "line-opacity": palette.routeOpacity,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 5],
        },
      },
      {
        id: MARKS_LAYER,
        type: "circle",
        source: MARKS_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 3],
          "circle-color": palette.markerStroke,
          "circle-opacity": 0.9,
          "circle-stroke-color": palette.routeColor,
          "circle-stroke-width": 1,
        },
      },
      {
        id: ENDS_LAYER,
        type: "circle",
        source: ENDS_SOURCE,
        paint: {
          "circle-radius": 6,
          "circle-color": ["match", ["get", "end"], "start", palette.routeColor, palette.endFill],
          "circle-stroke-color": palette.markerStroke,
          "circle-stroke-width": 2,
        },
      },
    ],
  };
}
