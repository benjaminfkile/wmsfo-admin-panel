import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { ROUTE_ARROW_ICON, glyphsUrl } from "../../routeMap";
import type { Overlay } from "../../api/resources/themes";

// The theme preview's sample scene (admin.md 6.28): a route through the
// city with three time labels and the user marker, drawn over the theme
// body in the overlay colours, and the two views the MapLibre preview
// shows it at.

export type LngLat = [number, number];

export const SAMPLE_ROUTE: readonly LngLat[] = [
  [-114.0215, 46.8590],
  [-114.0105, 46.8642],
  [-114.0012, 46.8688],
  [-113.9935, 46.8721],
  [-113.9862, 46.8760],
  [-113.9778, 46.8746],
  [-113.9742, 46.8689],
  [-113.9810, 46.8641],
  [-113.9907, 46.8612],
];

export const SAMPLE_TIME_LABELS: ReadonlyArray<{ at: LngLat; label: string }> = [
  { at: SAMPLE_ROUTE[1]!, label: "6:15 PM" },
  { at: SAMPLE_ROUTE[4]!, label: "6:30 PM" },
  { at: SAMPLE_ROUTE[7]!, label: "6:45 PM" },
];

export const SAMPLE_USER: LngLat = [-113.9965, 46.8668];

export type PreviewView = { label: string; center: LngLat; zoom: number };

// The valley at zoom 11 first (the one Render thumbnail captures), the
// city at zoom 14 second.
export const PREVIEW_VIEWS: readonly PreviewView[] = [
  { label: "Valley, zoom 11", center: [-114.03, 46.88], zoom: 11 },
  { label: "City, zoom 14", center: [-113.995, 46.868], zoom: 14 },
];

const ROUTE_SOURCE = "preview-route";
const LABELS_SOURCE = "preview-time-labels";
const USER_SOURCE = "preview-user";

// The sample route as `{ lat, lng }` points, for the Google preview.
export function samplePath(): Array<{ lat: number; lng: number }> {
  return SAMPLE_ROUTE.map(([lng, lat]) => ({ lat, lng }));
}

function overlayLayers(o: Overlay): LayerSpecification[] {
  return [
    {
      id: "preview-route-line",
      type: "line",
      source: ROUTE_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": o.routeColor,
        "line-opacity": o.routeOpacity,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 5],
      },
    },
    {
      id: "preview-route-arrows",
      type: "symbol",
      source: ROUTE_SOURCE,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 140,
        "icon-image": ROUTE_ARROW_ICON,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-color": o.arrowColor, "icon-opacity": o.routeOpacity },
    },
    {
      id: "preview-time-labels",
      type: "symbol",
      source: LABELS_SOURCE,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Medium"],
        "text-size": 14,
        "text-offset": [0, -1.4],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": o.timeLabelFg,
        "text-halo-color": o.timeLabelBg,
        "text-halo-width": 4,
        "text-opacity": o.timeLabelOpacity,
      },
    },
    {
      id: "preview-user",
      type: "circle",
      source: USER_SOURCE,
      paint: {
        "circle-radius": 8,
        "circle-color": o.userColor,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    },
  ];
}

// The theme body (already pointed at the dev basemap) with the sample
// route, its arrows, the three time labels, and the user marker drawn
// over it in the overlay colours. A body without `glyphs` takes the dev
// basemap's, so the time labels draw.
export function previewStyle(
  body: StyleSpecification,
  overlay: Overlay,
  basemapBase: string,
): StyleSpecification {
  return {
    ...body,
    glyphs: body.glyphs ?? glyphsUrl(basemapBase),
    sources: {
      ...body.sources,
      [ROUTE_SOURCE]: {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: SAMPLE_ROUTE.map((p) => [...p]) },
        },
      },
      [LABELS_SOURCE]: {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: SAMPLE_TIME_LABELS.map(({ at, label }) => ({
            type: "Feature" as const,
            properties: { label },
            geometry: { type: "Point" as const, coordinates: [...at] },
          })),
        },
      },
      [USER_SOURCE]: {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [...SAMPLE_USER] },
        },
      },
    },
    layers: [...body.layers, ...overlayLayers(overlay)],
  };
}
