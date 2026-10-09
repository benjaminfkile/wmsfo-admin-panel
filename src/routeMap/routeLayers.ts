// The panel's own route layers, drawn over a tracker theme body (admin.md
// 2.11): the route path as a line, the timeline marks as small dots on
// it, the start and end markers as circles, and, on request, arrowheads
// along the line and time labels beside dots. Every colour comes from
// the theme's `overlay` (the route colour and opacity, the arrow colour,
// the time label pair and opacity) unless `routeColor` overrides the
// route colour, which then also colours the arrows, the mark rings, the
// start marker, and the time label dots.
//  - `arrows` adds a symbol layer along the route line that repeats the
//    ROUTE_ARROW_ICON arrowhead at an even spacing, turned along the line
//    direction and tinted through icon-color. The icon is the SDF image
//    makeRouteArrowImage returns; the map owner adds it under
//    ROUTE_ARROW_ICON, the style only names it. `arrowScale` (default 1,
//    values at or under 0 read as 1) multiplies both the icon size and
//    the spacing.
//  - `routeWidthScale` (default 1, values at or under 0 read as 1)
//    multiplies the route line's width at every zoom stop.
//  - `timeLabels` adds, for each entry, a dot slightly larger than the
//    marks at its point and its ready made `label` beside it, in Noto Sans
//    Medium (20 px at full size) with a strong halo. MapLibre's collision
//    handling places the labels, so no two overlap.
// The time label sizes (the text and the dots under it) follow the zoom:
// LABEL_CURVE multiplies each by LABEL_MIN_FACTOR at LABEL_ZOOM_LOW and
// under and grows it linearly to its full size at LABEL_ZOOM_HIGH and
// over. `labelScale` (default 1, values at or under 0 read as 1)
// multiplies every one of those sizes. `labelCurve` "flat" drops the zoom
// factor, so the text size is a single number and the dots keep their
// own zoom stops; POSTER_LABELS (a scale of 1 on the flat curve) gives
// the poster's label sizes.
// `withoutDetails` drops the theme layers a Map details group names.

import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { Overlay } from "../api/resources/themes";
import type { TrackerTheme } from "../api/types";
import { isPlacesLayer } from "./themeStyle";

export type LatLng = { lat: number; lng: number };

export const ROUTE_SOURCE = "route";
export const ENDS_SOURCE = "route-ends";
export const MARKS_SOURCE = "route-marks";
export const ROUTE_LAYER = "route-line";
export const MARKS_LAYER = "route-marks";
export const ENDS_LAYER = "route-ends";
export const ARROWS_LAYER = "route-arrows";
export const TIME_LABELS_SOURCE = "route-time-labels";
export const TIME_LABEL_DOTS_LAYER = "route-time-label-dots";
export const TIME_LABELS_LAYER = "route-time-labels";
export const ROUTE_ARROW_ICON = "route-arrow";

export type TimeLabel = { lat: number; lng: number; label: string };

export type LabelCurve = "zoom" | "flat";

export type RouteLayerOptions = {
  routeColor?: string;
  arrows?: boolean;
  arrowScale?: number;
  routeWidthScale?: number;
  timeLabels?: readonly TimeLabel[];
  labelScale?: number;
  labelCurve?: LabelCurve;
};

// The label options the poster passes: its text and dots at their full
// sizes at every zoom.
export const POSTER_LABELS: Readonly<Pick<RouteLayerOptions, "labelScale" | "labelCurve">> = {
  labelScale: 1,
  labelCurve: "flat",
};

export type StyleDetails = {
  landmarks?: boolean;
  placeNames?: boolean;
  roadLabels?: boolean;
};

// The theme layer ids each Map details switch drops, as the two seeded
// MapLibre themes name them. Landmarks also drops every layer marked
// `wmsfo:places`, so it acts on a theme whose places layer is named
// otherwise.
//  - landmarks:  `pois`, the points of interest with their names.
//  - placeNames: `places_locality`, the city, town, and village names, and
//                `places_subplace`, the neighbourhood names.
//  - roadLabels: `roads_labels_major` and `roads_labels_minor`.
export const DETAIL_LAYERS: Readonly<Record<keyof StyleDetails, readonly string[]>> = {
  landmarks: ["pois"],
  placeNames: ["places_locality", "places_subplace"],
  roadLabels: ["roads_labels_major", "roads_labels_minor"],
};

// A copy of the style without the layers of each detail group turned off.
// An absent key keeps its group.
export function withoutDetails(
  style: StyleSpecification,
  details: StyleDetails,
): StyleSpecification {
  const hidden = new Set<string>();
  for (const group of Object.keys(DETAIL_LAYERS) as (keyof StyleDetails)[]) {
    if (details[group] === false) for (const id of DETAIL_LAYERS[group]) hidden.add(id);
  }
  const dropPlaces = details.landmarks === false;
  if (hidden.size === 0) return style;
  return {
    ...style,
    layers: style.layers.filter(
      (layer) => !hidden.has(layer.id) && !(dropPlaces && isPlacesLayer(layer)),
    ),
  };
}

// The overlay colours of the route-light seed, for a theme row that lacks
// one of them.
const FALLBACK_OVERLAY: Overlay = {
  routeColor: "#1a56c4",
  routeOpacity: 0.9,
  arrowColor: "#1a56c4",
  timeLabelBg: "#ffffff",
  timeLabelFg: "#202124",
  timeLabelOpacity: 1,
  userColor: "#c62828",
};

function opacity(value: unknown, fallback: number): number {
  const n = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
}

// The theme row's overlay colours with every number read as a number.
export function themeOverlay(theme: Pick<TrackerTheme, "overlay">): Overlay {
  const o = theme.overlay ?? {};
  return {
    routeColor: o.routeColor || FALLBACK_OVERLAY.routeColor,
    routeOpacity: opacity(o.routeOpacity, FALLBACK_OVERLAY.routeOpacity),
    arrowColor: o.arrowColor || o.routeColor || FALLBACK_OVERLAY.arrowColor,
    timeLabelBg: o.timeLabelBg || FALLBACK_OVERLAY.timeLabelBg,
    timeLabelFg: o.timeLabelFg || FALLBACK_OVERLAY.timeLabelFg,
    timeLabelOpacity: opacity(o.timeLabelOpacity, FALLBACK_OVERLAY.timeLabelOpacity),
    userColor: o.userColor || FALLBACK_OVERLAY.userColor,
  };
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

// The route line width in pixels at zoom 8 and zoom 14, at a route width
// scale of 1.
const ROUTE_WIDTH_Z8 = 3;
const ROUTE_WIDTH_Z14 = 5;

// The full label sizes: the text in pixels, and the dot radius in pixels
// as [zoom, radius] stops.
const TIME_LABEL_TEXT_SIZE = 20;
const TIME_LABEL_DOT_STOPS: readonly Stop[] = [[8, 3.5], [14, 4.5]];

// The zoom curve of the label sizes: LABEL_MIN_FACTOR of the full size at
// LABEL_ZOOM_LOW and under, the full size at LABEL_ZOOM_HIGH and over, and
// linear between.
const LABEL_ZOOM_LOW = 12;
const LABEL_ZOOM_HIGH = 16;
const LABEL_MIN_FACTOR = 2 / 3;
export const LABEL_CURVE: readonly Stop[] = [
  [LABEL_ZOOM_LOW, LABEL_MIN_FACTOR],
  [LABEL_ZOOM_HIGH, 1],
];

type Stop = readonly [zoom: number, value: number];

// The value of piecewise linear stops at a zoom, held flat past either end.
function atZoom(stops: readonly Stop[], zoom: number): number {
  const first = stops[0]!;
  if (zoom <= first[0]) return first[1];
  for (let i = 1; i < stops.length; i++) {
    const [z1, v1] = stops[i]!;
    if (zoom <= z1) {
      const [z0, v0] = stops[i - 1]!;
      return v0 + ((v1 - v0) * (zoom - z0)) / (z1 - z0);
    }
  }
  return stops[stops.length - 1]![1];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// A label size: the base stops (one stop for a text size) times the zoom
// curve and the scale, as a zoom interpolation over every stop of both;
// on the flat curve a single base stop stays a plain number.
function labelSize(
  base: readonly Stop[],
  scale: number,
  curve: LabelCurve,
): number | ExpressionSpecification {
  if (curve === "flat" && base.length === 1) return round(base[0]![1] * scale);
  const baseZooms = base.length === 1 ? [] : base.map(([zoom]) => zoom);
  const zooms = curve === "flat"
    ? baseZooms
    : [...new Set([...baseZooms, LABEL_ZOOM_LOW, LABEL_ZOOM_HIGH])].sort((a, b) => a - b);
  const stops = zooms.flatMap((zoom) => [
    zoom,
    round(atZoom(base, zoom) * (curve === "flat" ? 1 : atZoom(LABEL_CURVE, zoom)) * scale),
  ]);
  return ["interpolate", ["linear"], ["zoom"], ...stops] as ExpressionSpecification;
}

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
    const [xi, yi] = ARROW_OUTLINE[i]!;
    const [xj, yj] = ARROW_OUTLINE[j]!;
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
        const next = ARROW_OUTLINE[(i + 1) % ARROW_OUTLINE.length]!;
        distance = Math.min(distance, segmentDistance(px, py, ARROW_OUTLINE[i]!, next));
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

export const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

// [[west, south], [east, north]] around the path, or null when it is empty.
export function pathBounds(path: readonly LatLng[]): [[number, number], [number, number]] | null {
  const first = path[0];
  if (!first) return null;
  let west = first.lng;
  let east = first.lng;
  let south = first.lat;
  let north = first.lat;
  for (const p of path) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  return [[west, south], [east, north]];
}

function points(list: readonly LatLng[]) {
  return list.map((point) => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
  }));
}

// The style with the route's sources and layers added over every layer
// it already has, in the overlay colours.
export function withRouteLayers(
  style: StyleSpecification,
  overlay: Overlay,
  path: readonly LatLng[],
  marks: readonly LatLng[] = [],
  options: RouteLayerOptions = {},
): StyleSpecification {
  const routeColor = options.routeColor ?? overlay.routeColor;
  const arrowColor = options.routeColor ?? overlay.arrowColor;
  const timeLabels = options.timeLabels ?? [];
  const arrowScale =
    options.arrowScale !== undefined && options.arrowScale > 0 ? options.arrowScale : 1;
  const routeWidthScale =
    options.routeWidthScale !== undefined && options.routeWidthScale > 0
      ? options.routeWidthScale
      : 1;
  const labelScale =
    options.labelScale !== undefined && options.labelScale > 0 ? options.labelScale : 1;
  const labelCurve: LabelCurve = options.labelCurve === "flat" ? "flat" : "zoom";
  const first = path[0];
  const last = path[path.length - 1];
  const ends = first && last
    ? [
        { end: "start", point: first },
        { end: "end", point: last },
      ]
    : [];
  const layers: LayerSpecification[] = [
    {
      id: ROUTE_LAYER,
      type: "line",
      source: ROUTE_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": routeColor,
        "line-opacity": overlay.routeOpacity,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          ROUTE_WIDTH_Z8 * routeWidthScale,
          14,
          ROUTE_WIDTH_Z14 * routeWidthScale,
        ],
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
              "icon-color": arrowColor,
              "icon-opacity": overlay.routeOpacity,
            },
          } satisfies LayerSpecification,
        ]
      : []),
    {
      id: MARKS_LAYER,
      type: "circle",
      source: MARKS_SOURCE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 3],
        "circle-color": overlay.timeLabelBg,
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
        "circle-color": ["match", ["get", "end"], "start", routeColor, overlay.timeLabelFg],
        "circle-stroke-color": overlay.timeLabelBg,
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
              "circle-radius": labelSize(TIME_LABEL_DOT_STOPS, labelScale, labelCurve),
              "circle-color": routeColor,
              "circle-stroke-color": overlay.timeLabelBg,
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
              "text-size": labelSize([[0, TIME_LABEL_TEXT_SIZE]], labelScale, labelCurve),
              "text-variable-anchor": ["left", "right", "top", "bottom"],
              "text-radial-offset": 0.6,
              "text-justify": "auto",
            },
            paint: {
              "text-color": overlay.timeLabelFg,
              "text-halo-color": overlay.timeLabelBg,
              "text-halo-width": 3,
              "text-opacity": overlay.timeLabelOpacity,
            },
          } satisfies LayerSpecification,
        ]
      : []),
  ];
  return {
    ...style,
    sources: {
      ...style.sources,
      [ROUTE_SOURCE]: {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: path.map((p) => [p.lng, p.lat]) },
        },
      },
      [MARKS_SOURCE]: {
        type: "geojson",
        data: { type: "FeatureCollection", features: points(marks) },
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
    layers: [...style.layers, ...layers],
  };
}
