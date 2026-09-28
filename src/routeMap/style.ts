// docs/site.md section 8.9. Builds the MapLibre style of the route map for
// one appearance: the @protomaps/basemaps layers over the CDN basemap in
// that appearance's flavor, then the route path as a line, the timeline
// marks as small dots on it, and the start and end markers as circles.
// With `terrain` set, a raster-dem source over the terrain archive
// (terrarium encoding) feeds a hillshade layer placed just under the
// water fill, so the relief shades the ground and landuse while water,
// water lines, roads, labels, and the route draw over it. Both
// appearances share every source and layer id for the same terrain
// state, so a switch between them is a paint-only style diff, and the
// terrain toggle adds or removes one source and one layer.
// Three optional capabilities serve the route poster; without them the
// style is exactly the one described above:
//  - `routeColor` replaces the palette's route colour everywhere it is
//    drawn (the line, the mark rings, the start marker fill, and the two
//    additions below).
//  - `arrows` adds a symbol layer along the route line that repeats the
//    ROUTE_ARROW_ICON arrowhead at an even spacing, turned along the line
//    direction and tinted through icon-color. The icon is the SDF image
//    makeRouteArrowImage returns; the map owner adds it under
//    ROUTE_ARROW_ICON, the style only names it.
//  - `timeLabels` adds, for each entry, a dot slightly larger than the
//    marks at its point and its ready made `label` beside it, in Noto Sans
//    Medium larger than the basemap's town labels, with a strong halo in
//    the palette's label pair. MapLibre's collision handling places the
//    labels, so no two overlap.

import { layers } from "@protomaps/basemaps";
import type {
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { FLAVORS, HILLSHADE_PAINTS, ROUTE_PALETTES, type Appearance } from "./flavors";

export type LatLng = { lat: number; lng: number };

export const BASEMAP_SOURCE = "protomaps";
export const ROUTE_SOURCE = "route";
export const ENDS_SOURCE = "route-ends";
export const MARKS_SOURCE = "route-marks";
export const ROUTE_LAYER = "route-line";
export const MARKS_LAYER = "route-marks";
export const ENDS_LAYER = "route-ends";
export const TERRAIN_SOURCE = "terrain";
export const HILLSHADE_LAYER = "terrain-hillshade";
export const ARROWS_LAYER = "route-arrows";
export const TIME_LABELS_SOURCE = "route-time-labels";
export const TIME_LABEL_DOTS_LAYER = "route-time-label-dots";
export const TIME_LABELS_LAYER = "route-time-labels";
export const ROUTE_ARROW_ICON = "route-arrow";

export type TimeLabel = { lat: number; lng: number; label: string };

export type StyleOptions = {
  routeColor?: string;
  arrows?: boolean;
  timeLabels?: readonly TimeLabel[];
};

// The arrowhead image: ARROW_SIZE device pixels square at ARROW_PIXEL_RATIO,
// a notched head pointing along +x (the line direction of a line placed
// symbol), encoded as a signed distance field over ARROW_SDF_RADIUS pixels
// with the edge at ARROW_SDF_CUTOFF, the encoding MapLibre's SDF icons read.
const ARROW_SIZE = 32;
const ARROW_PIXEL_RATIO = 2;
const ARROW_SDF_RADIUS = 8;
const ARROW_SDF_CUTOFF = 0.25;
const ARROW_OUTLINE: readonly (readonly [number, number])[] = [
  [24, 16],
  [9, 7],
  [13, 16],
  [9, 25],
];

// Pixels between arrowheads along the line.
const ARROW_SPACING = 140;

export type RouteArrowImage = {
  data: { width: number; height: number; data: Uint8ClampedArray };
  options: { sdf: true; pixelRatio: number };
};

function segmentDistance(
  px: number,
  py: number,
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insideOutline(px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = ARROW_OUTLINE.length - 1; i < ARROW_OUTLINE.length; j = i++) {
    const [xi, yi] = ARROW_OUTLINE[i];
    const [xj, yj] = ARROW_OUTLINE[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Draws the arrowhead on a small RGBA canvas, white with the signed
// distance to its outline in the alpha channel, ready for
// map.addImage(ROUTE_ARROW_ICON, data, options).
export function makeRouteArrowImage(): RouteArrowImage {
  const data = new Uint8ClampedArray(ARROW_SIZE * ARROW_SIZE * 4);
  for (let y = 0; y < ARROW_SIZE; y++) {
    for (let x = 0; x < ARROW_SIZE; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let distance = Infinity;
      for (let i = 0; i < ARROW_OUTLINE.length; i++) {
        const next = ARROW_OUTLINE[(i + 1) % ARROW_OUTLINE.length];
        distance = Math.min(distance, segmentDistance(px, py, ARROW_OUTLINE[i], next));
      }
      const signed = insideOutline(px, py) ? -distance : distance;
      const at = (y * ARROW_SIZE + x) * 4;
      data[at] = 255;
      data[at + 1] = 255;
      data[at + 2] = 255;
      data[at + 3] = Math.round(255 - 255 * (signed / ARROW_SDF_RADIUS + ARROW_SDF_CUTOFF));
    }
  }
  return {
    data: { width: ARROW_SIZE, height: ARROW_SIZE, data },
    options: { sdf: true, pixelRatio: ARROW_PIXEL_RATIO },
  };
}

// The basemap layer the hillshade sits directly under.
const HILLSHADE_BEFORE = "water";

export const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

// Symbol layers that need the basemap sprite, which the CDN basemap does
// not carry: one-way arrows and road shields are left out, and the
// remaining layers keep their text without the icon.
const SPRITE_ONLY_LAYERS = new Set(["roads_oneway", "roads_shields"]);

export function tilesUrl(base: string): string {
  return `${base}/tiles.pmtiles`;
}

export function terrainUrl(base: string): string {
  return `${base}/terrain.pmtiles`;
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

function basemapLayers(appearance: Appearance, terrain: boolean): LayerSpecification[] {
  const base = layers(BASEMAP_SOURCE, FLAVORS[appearance], { lang: "en" })
    .filter((layer) => !SPRITE_ONLY_LAYERS.has(layer.id))
    .map((layer) => {
      if (layer.type !== "symbol" || layer.layout === undefined) return layer;
      const layout = Object.fromEntries(
        Object.entries(layer.layout).filter(([key]) => !key.startsWith("icon-")),
      );
      return { ...layer, layout } as LayerSpecification;
    });
  if (!terrain) return base;
  const hillshade: LayerSpecification = {
    id: HILLSHADE_LAYER,
    type: "hillshade",
    source: TERRAIN_SOURCE,
    paint: { ...HILLSHADE_PAINTS[appearance] },
  };
  const at = base.findIndex((layer) => layer.id === HILLSHADE_BEFORE);
  const index = at === -1 ? 1 : at;
  return [...base.slice(0, index), hillshade, ...base.slice(index)];
}

export function buildStyle(
  appearance: Appearance,
  base: string,
  path: readonly LatLng[],
  marks: readonly LatLng[] = [],
  terrain = false,
  options: StyleOptions = {},
): StyleSpecification {
  const palette = ROUTE_PALETTES[appearance];
  const routeColor = options.routeColor ?? palette.routeColor;
  const timeLabels = options.timeLabels ?? [];
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
      ...(terrain
        ? {
            [TERRAIN_SOURCE]: {
              type: "raster-dem" as const,
              url: `pmtiles://${terrainUrl(base)}`,
              encoding: "terrarium" as const,
            },
          }
        : {}),
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
      ...(timeLabels.length > 0
        ? {
            [TIME_LABELS_SOURCE]: {
              type: "geojson" as const,
              data: {
                type: "FeatureCollection" as const,
                features: timeLabels.map(({ lat, lng, label }) => ({
                  type: "Feature" as const,
                  properties: { label },
                  geometry: { type: "Point" as const, coordinates: [lng, lat] },
                })),
              },
            },
          }
        : {}),
    },
    layers: [
      ...basemapLayers(appearance, terrain),
      {
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": routeColor,
          "line-opacity": palette.routeOpacity,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 5],
        },
      },
      ...(options.arrows === true
        ? [
            {
              id: ARROWS_LAYER,
              type: "symbol" as const,
              source: ROUTE_SOURCE,
              layout: {
                "symbol-placement": "line" as const,
                "symbol-spacing": ARROW_SPACING,
                "icon-image": ROUTE_ARROW_ICON,
                "icon-rotation-alignment": "map" as const,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
              paint: {
                "icon-color": routeColor,
                "icon-opacity": palette.routeOpacity,
              },
            },
          ]
        : []),
      {
        id: MARKS_LAYER,
        type: "circle",
        source: MARKS_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 3],
          "circle-color": palette.markerStroke,
          "circle-opacity": 0.9,
          "circle-stroke-color": routeColor,
          "circle-stroke-width": 1,
        },
      },
      {
        id: ENDS_LAYER,
        type: "circle",
        source: ENDS_SOURCE,
        paint: {
          "circle-radius": 6,
          "circle-color": ["match", ["get", "end"], "start", routeColor, palette.endFill],
          "circle-stroke-color": palette.markerStroke,
          "circle-stroke-width": 2,
        },
      },
      ...(timeLabels.length > 0
        ? [
            {
              id: TIME_LABEL_DOTS_LAYER,
              type: "circle" as const,
              source: TIME_LABELS_SOURCE,
              paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 4.5],
                "circle-color": routeColor,
                "circle-stroke-color": palette.markerStroke,
                "circle-stroke-width": 1.5,
              },
            } satisfies LayerSpecification,
            {
              id: TIME_LABELS_LAYER,
              type: "symbol" as const,
              source: TIME_LABELS_SOURCE,
              layout: {
                "text-field": ["get", "label"],
                "text-font": ["Noto Sans Medium"],
                "text-size": 20,
                "text-variable-anchor": ["left", "right", "top", "bottom"],
                "text-radial-offset": 0.6,
                "text-justify": "auto",
              },
              paint: {
                "text-color": palette.labelText,
                "text-halo-color": palette.labelHalo,
                "text-halo-width": 3,
              },
            } satisfies LayerSpecification,
          ]
        : []),
    ],
  };
}
