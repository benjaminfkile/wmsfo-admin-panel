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
//    ROUTE_ARROW_ICON, the style only names it. `arrowScale` (default 1,
//    values at or under 0 read as 1) multiplies both the icon size and
//    the spacing, so larger arrowheads sit further apart.
//  - `timeLabels` adds, for each entry, a dot slightly larger than the
//    marks at its point and its ready made `label` beside it, in Noto Sans
//    Medium larger than the basemap's town labels, with a strong halo in
//    the palette's label pair. MapLibre's collision handling places the
//    labels, so no two overlap.
// One more option hides basemap detail: `details` turns off the POI
// labels (`landmarks`), the city, town, village, and neighbourhood labels
// (`placeNames`), or the road name labels (`roadLabels`) by dropping the
// basemap layers DETAIL_LAYERS names for that group. Each absent key
// keeps its group.
// Two more options serve the site's own map and the poster alike:
//  - `poiKinds` shows the basemap's POI labels for the listed kinds only.
//    The site flavors carry no POI colours, so the default style has no
//    POI layer; with a non empty list the style builds the flavor with
//    POI_COLOURS added, which adds exactly the DETAIL_LAYERS `landmarks`
//    layers, and each of them draws only features whose `kind` is in the
//    list, from the zoom the tile data carries the feature (see
//    poiLayer). A kind the package does not colour takes the flavor's
//    slategray instead of the ground colour. An empty list leaves the
//    style without POI layers, and `details.landmarks` false still drops
//    them.
//  - `landmarks` adds, for each entry, a dot in the palette's landmark
//    fill and ring (`route-landmark-dots`) and its `label` beside it
//    (`route-landmarks`) in Noto Sans Medium smaller than the time labels,
//    with the same halo pair. Both are drawn at every zoom. MapLibre's
//    collision handling places the labels; the time label layers sit
//    above them, so a time label wins a collision with a landmark.

import { layers } from "@protomaps/basemaps";
import type {
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import {
  FLAVORS,
  HILLSHADE_PAINTS,
  POI_COLOURS,
  ROUTE_PALETTES,
  type Appearance,
} from "./flavors";

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
export const LANDMARKS_SOURCE = "route-landmarks";
export const LANDMARK_DOTS_LAYER = "route-landmark-dots";
export const LANDMARKS_LAYER = "route-landmarks";
export const ROUTE_ARROW_ICON = "route-arrow";

export type TimeLabel = { lat: number; lng: number; label: string };
export type Landmark = { lat: number; lng: number; label: string };

export type StyleOptions = {
  routeColor?: string;
  arrows?: boolean;
  arrowScale?: number;
  timeLabels?: readonly TimeLabel[];
  details?: StyleDetails;
  poiKinds?: readonly string[];
  landmarks?: readonly Landmark[];
};

export type StyleDetails = {
  landmarks?: boolean;
  placeNames?: boolean;
  roadLabels?: boolean;
};

// The @protomaps/basemaps layer ids each detail switch drops, all symbol
// layers. A package bump that renames or splits them has to be re-checked
// against this table; the unit test reads the ids back out of the
// generated layers and fails when they no longer match.
//  - landmarks:  `pois`, the points of interest (parks, stations, schools,
//                peaks, and the like) with their names. The package only
//                generates it for a flavor with `pois` colours, which the
//                flavors in flavors.ts do not set, so the built style
//                carries it only when `poiKinds` lists a kind.
//  - placeNames: `places_locality`, the city, town, and village names, and
//                `places_subplace`, the neighbourhood names. Country and
//                region names stay.
//  - roadLabels: `roads_labels_major` and `roads_labels_minor`, the road
//                names drawn along the roads.
export const DETAIL_LAYERS: Readonly<Record<keyof StyleDetails, readonly string[]>> = {
  landmarks: ["pois"],
  placeNames: ["places_locality", "places_subplace"],
  roadLabels: ["roads_labels_major", "roads_labels_minor"],
};

// The tile build writes each POI into the tiles from one zoom below the
// `min_zoom` it stores on the feature, and the package's POI layer shows
// a feature only from that `min_zoom`. A chosen kind shows from the zoom
// its tile data begins.
const POI_TILE_ZOOM_LEAD = 1;

// A package POI layer that keeps only the listed kinds, each from the
// zoom its tile data begins, and colours a kind the package does not
// name in the flavor's slategray.
function poiLayer(
  layer: LayerSpecification,
  kinds: readonly string[],
  appearance: Appearance,
): LayerSpecification {
  if (layer.type !== "symbol") return layer;
  const filter = [
    "all",
    ["in", ["get", "kind"], ["literal", [...kinds]]],
    [">=", ["zoom"], ["-", ["get", "min_zoom"], POI_TILE_ZOOM_LEAD]],
  ];
  const color = layer.paint?.["text-color"];
  const paint = Array.isArray(color) && color[0] === "case"
    ? { ...layer.paint, "text-color": [...color.slice(0, -1), POI_COLOURS[appearance].slategray] }
    : layer.paint;
  return { ...layer, filter, paint } as LayerSpecification;
}

function hiddenDetailLayers(details: StyleDetails): Set<string> {
  const hidden = new Set<string>();
  for (const group of Object.keys(DETAIL_LAYERS) as (keyof StyleDetails)[]) {
    if (details[group] === false) for (const id of DETAIL_LAYERS[group]) hidden.add(id);
  }
  return hidden;
}

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

// Pixels between arrowheads along the line, and the icon size, both at
// an arrow scale of 1.
const ARROW_SPACING = 140;
const ARROW_ICON_SIZE = 1;

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

function basemapLayers(
  appearance: Appearance,
  terrain: boolean,
  details: StyleDetails,
  poiKinds: readonly string[] | undefined,
): LayerSpecification[] {
  const hidden = hiddenDetailLayers(details);
  const pois = new Set(DETAIL_LAYERS.landmarks);
  const withPois = poiKinds !== undefined && poiKinds.length > 0;
  const flavor = withPois
    ? { ...FLAVORS[appearance], pois: POI_COLOURS[appearance] }
    : FLAVORS[appearance];
  const base = layers(BASEMAP_SOURCE, flavor, { lang: "en" })
    .filter((layer) => !SPRITE_ONLY_LAYERS.has(layer.id) && !hidden.has(layer.id))
    .filter((layer) => poiKinds === undefined || withPois || !pois.has(layer.id))
    .map((layer) => (withPois && pois.has(layer.id) ? poiLayer(layer, poiKinds, appearance) : layer))
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
  const landmarks = options.landmarks ?? [];
  const arrowScale =
    options.arrowScale !== undefined && options.arrowScale > 0 ? options.arrowScale : 1;
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
      ...(landmarks.length > 0
        ? {
            [LANDMARKS_SOURCE]: {
              type: "geojson" as const,
              data: {
                type: "FeatureCollection" as const,
                features: landmarks.map(({ lat, lng, label }) => ({
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
      ...basemapLayers(appearance, terrain, options.details ?? {}, options.poiKinds),
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
                "symbol-spacing": ARROW_SPACING * arrowScale,
                "icon-image": ROUTE_ARROW_ICON,
                "icon-size": ARROW_ICON_SIZE * arrowScale,
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
      ...(landmarks.length > 0
        ? [
            {
              id: LANDMARK_DOTS_LAYER,
              type: "circle" as const,
              source: LANDMARKS_SOURCE,
              paint: {
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 3.5],
                "circle-color": palette.landmarkFill,
                "circle-stroke-color": palette.landmarkStroke,
                "circle-stroke-width": 1,
              },
            } satisfies LayerSpecification,
            {
              id: LANDMARKS_LAYER,
              type: "symbol" as const,
              source: LANDMARKS_SOURCE,
              layout: {
                "text-field": ["get", "label"],
                "text-font": ["Noto Sans Medium"],
                "text-size": 14,
                "text-variable-anchor": ["left", "right", "top", "bottom"],
                "text-radial-offset": 0.5,
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
