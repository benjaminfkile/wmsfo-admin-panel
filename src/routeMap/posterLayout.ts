// The poster layout document stored on a poster as its `layout`: the
// whole design of the poster studio (theme, orientation, size, terrain,
// the map details, the route styling) and the overlay elements drawn over
// the map. The
// shape is the panel's own (admin.md 6.3, Poster studio). Every position
// and size is a fraction of the poster's width and height, so one layout
// fits every preset and both orientations.

import {
  ARROW_SCALES,
  DEFAULT_ARROWS,
  DEFAULT_ARROW_SCALE,
  DEFAULT_TIME_LABEL_FORMAT,
  DEFAULT_TIME_LABEL_INTERVAL,
  TIME_LABEL_FORMATS,
  TIME_LABEL_INTERVALS,
  isHexColor,
  type ArrowScale,
  type TimeLabelFormat,
  type TimeLabelInterval,
} from "./posterStyle";
import {
  POSTER_PRESETS,
  type PosterOrientation,
  type PosterPresetId,
  type PosterSize,
} from "./poster";
import type { Appearance } from "./flavors";

export const POSTER_LAYOUT_VERSION = 1;

export type LayoutRouteStyle = {
  // "#rrggbb", or null for the theme's route colour.
  colour: string | null;
  arrows: boolean;
  // The arrowhead size multiplier; absent in a saved layout reads Large.
  arrowScale: ArrowScale;
  labels: LayoutLabels;
};

export type LayoutLabels = {
  interval: TimeLabelInterval;
  format: TimeLabelFormat;
  // The flight's start as a "yyyy-MM-ddTHH:mm" wall time in `zone`, the
  // origin of the wall clock labels; null when unset.
  start: string | null;
  // The IANA zone of the start and the wall clock labels; null for the
  // viewer's zone.
  zone: string | null;
};

// The map choices of the studio: the theme, the orientation, the size
// preset, and whether the hillshade is drawn.
export type LayoutMap = {
  theme: Appearance;
  orientation: PosterOrientation;
  size: PosterPresetId;
  terrain: boolean;
};

// The basemap detail switches: the points of interest names
// (`landmarks`), the city, town, village, and neighbourhood names
// (`placeNames`), and the road names (`roadLabels`). True draws the group.
export type LayoutDetails = {
  landmarks: boolean;
  placeNames: boolean;
  roadLabels: boolean;
};

// Everything in the document but the elements.
export type PosterDesign = LayoutMap & { details: LayoutDetails; routeStyle: LayoutRouteStyle };

// Where an element sits: `x` and `y` are its centre over the poster's
// width and height, `width` is its width over the poster's width (the
// height follows the element's own aspect), `rotation` is clockwise
// degrees about the centre, and `z` is its stacking order, 0 at the back.
export type Placement = {
  x: number;
  y: number;
  width: number;
  rotation: number;
  z: number;
};

export type ImageElement = Placement & { type: "image"; mediaId: string };
export type LogoElement = Placement & { type: "logo"; mediaId: string };
export type QrElement = Placement & { type: "qr"; qrId: number; tag: string };
export type LayoutElement = ImageElement | LogoElement | QrElement;

export type PosterLayout = PosterDesign & {
  version: typeof POSTER_LAYOUT_VERSION;
  elements: LayoutElement[];
};

export const DEFAULT_ROUTE_STYLE: LayoutRouteStyle = {
  colour: null,
  arrows: DEFAULT_ARROWS,
  arrowScale: DEFAULT_ARROW_SCALE,
  labels: {
    interval: DEFAULT_TIME_LABEL_INTERVAL,
    format: DEFAULT_TIME_LABEL_FORMAT,
    start: null,
    zone: null,
  },
};

export const DEFAULT_MAP: LayoutMap = {
  theme: "light",
  orientation: "landscape",
  size: "facebook",
  terrain: false,
};

export const DEFAULT_DETAILS: LayoutDetails = {
  landmarks: true,
  placeNames: true,
  roadLabels: true,
};

export const DEFAULT_DESIGN: PosterDesign = {
  ...DEFAULT_MAP,
  details: DEFAULT_DETAILS,
  routeStyle: DEFAULT_ROUTE_STYLE,
};

// The document for the design and the elements in stacking order; each
// element's `z` is its index.
export function toLayoutDocument(
  design: PosterDesign,
  elements: readonly LayoutElement[],
): PosterLayout {
  const { routeStyle } = design;
  const { labels } = routeStyle;
  return {
    version: POSTER_LAYOUT_VERSION,
    theme: design.theme,
    orientation: design.orientation,
    size: design.size,
    terrain: design.terrain,
    details: {
      landmarks: design.details.landmarks,
      placeNames: design.details.placeNames,
      roadLabels: design.details.roadLabels,
    },
    routeStyle: {
      colour: routeStyle.colour,
      arrows: routeStyle.arrows,
      arrowScale: routeStyle.arrowScale,
      labels: {
        interval: labels.interval,
        format: labels.format,
        start: labels.start,
        zone: labels.zone,
      },
    },
    elements: elements.map((el, z) => cleanElement(el, z)),
  };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function cleanElement(el: LayoutElement, z: number): LayoutElement {
  const placement: Placement = {
    x: round(el.x),
    y: round(el.y),
    width: round(el.width),
    rotation: round(el.rotation),
    z,
  };
  switch (el.type) {
    case "image":
      return { type: "image", mediaId: el.mediaId, ...placement };
    case "logo":
      return { type: "logo", mediaId: el.mediaId, ...placement };
    case "qr":
      return { type: "qr", qrId: el.qrId, tag: el.tag, ...placement };
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseRouteStyle(raw: unknown): LayoutRouteStyle {
  if (!isRecord(raw)) return DEFAULT_ROUTE_STYLE;
  const colour = typeof raw.colour === "string" && isHexColor(raw.colour) ? raw.colour.toLowerCase() : null;
  const arrows = typeof raw.arrows === "boolean" ? raw.arrows : DEFAULT_ARROWS;
  const arrowScale = ARROW_SCALES.find((o) => o.value === raw.arrowScale)?.value ?? DEFAULT_ARROW_SCALE;
  const labels = isRecord(raw.labels) ? raw.labels : {};
  const interval = TIME_LABEL_INTERVALS.find((o) => o.value === labels.interval)?.value ?? DEFAULT_TIME_LABEL_INTERVAL;
  const format = TIME_LABEL_FORMATS.find((o) => o.value === labels.format)?.value ?? DEFAULT_TIME_LABEL_FORMAT;
  const start = typeof labels.start === "string" && WALL_TIME.test(labels.start) ? labels.start : null;
  const zone = typeof labels.zone === "string" && labels.zone ? labels.zone : null;
  return { colour, arrows, arrowScale, labels: { interval, format, start, zone } };
}

// Each detail switch reads true unless the document holds false for it, so
// a document without `details` draws every group.
function parseDetails(raw: unknown): LayoutDetails {
  const details = isRecord(raw) ? raw : {};
  return {
    landmarks: details.landmarks !== false,
    placeNames: details.placeNames !== false,
    roadLabels: details.roadLabels !== false,
  };
}

const WALL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function parseMap(raw: Record<string, unknown>): LayoutMap {
  return {
    theme: raw.theme === "dark" || raw.theme === "light" ? raw.theme : DEFAULT_MAP.theme,
    orientation:
      raw.orientation === "portrait" || raw.orientation === "landscape"
        ? raw.orientation
        : DEFAULT_MAP.orientation,
    size: POSTER_PRESETS.find((p) => p.id === raw.size)?.id ?? DEFAULT_MAP.size,
    terrain: typeof raw.terrain === "boolean" ? raw.terrain : DEFAULT_MAP.terrain,
  };
}

function parseElement(raw: unknown): LayoutElement | null {
  if (!isRecord(raw)) return null;
  const x = finite(raw.x);
  const y = finite(raw.y);
  const width = finite(raw.width);
  if (x === null || y === null || width === null || width <= 0) return null;
  const placement: Placement = {
    x,
    y,
    width,
    rotation: finite(raw.rotation) ?? 0,
    z: finite(raw.z) ?? 0,
  };
  if ((raw.type === "image" || raw.type === "logo") && typeof raw.mediaId === "string" && raw.mediaId) {
    return { type: raw.type, mediaId: raw.mediaId, ...placement };
  }
  if (raw.type === "qr" && finite(raw.qrId) !== null && typeof raw.tag === "string" && raw.tag) {
    return { type: "qr", qrId: raw.qrId as number, tag: raw.tag, ...placement };
  }
  return null;
}

// Reads a saved layout. Anything that is not a version 1 document is
// null; a missing or unknown map choice or route style value reads its
// default, a detail switch reads on unless it is false, elements of an unknown type or without a placement are
// dropped, and the rest come back in stacking order.
export function parsePosterLayout(raw: unknown): PosterLayout | null {
  if (!isRecord(raw) || raw.version !== POSTER_LAYOUT_VERSION) return null;
  const elements = (Array.isArray(raw.elements) ? raw.elements : [])
    .map(parseElement)
    .filter((el): el is LayoutElement => el !== null)
    .sort((a, b) => a.z - b.z)
    .map((el, z) => ({ ...el, z }));
  return {
    version: POSTER_LAYOUT_VERSION,
    ...parseMap(raw),
    details: parseDetails(raw.details),
    routeStyle: parseRouteStyle(raw.routeStyle),
    elements,
  };
}

export type PixelBox = { x: number; y: number; width: number; height: number; rotation: number };

// The element in pixels on a poster (or a preview) of `size`: the centre,
// the width and height, and the rotation. `aspect` is the element's
// height over its width.
export function elementPixels(el: Placement, size: PosterSize, aspect: number): PixelBox {
  const width = el.width * size.width;
  return {
    x: el.x * size.width,
    y: el.y * size.height,
    width,
    height: width * aspect,
    rotation: el.rotation,
  };
}

// The placement of a pixel box on a poster (or a preview) of `size`; the
// inverse of elementPixels.
export function placementFromPixels(
  box: Pick<PixelBox, "x" | "y" | "width" | "rotation">,
  size: PosterSize,
): Omit<Placement, "z"> {
  return {
    x: box.x / size.width,
    y: box.y / size.height,
    width: box.width / size.width,
    rotation: box.rotation,
  };
}

// The name an element goes by in the dialog and its error messages.
export function elementLabel(el: LayoutElement, filename?: string | null): string {
  switch (el.type) {
    case "logo":
      return "the site logo";
    case "qr":
      return `QR code ${el.tag}`;
    case "image":
      return filename ? `image ${filename}` : `image ${el.mediaId}`;
  }
}

// How close, in display pixels, an edge or centre gets to a guide before
// it snaps to it.
export const SNAP_PX = 6;

// The nearest stop within SNAP_PX of any of the edges, as the shift that
// puts that edge on it, or null.
export function snapShift(edges: readonly number[], stops: readonly number[]): { shift: number; at: number } | null {
  let best: { shift: number; at: number } | null = null;
  for (const edge of edges) {
    for (const stop of stops) {
      const shift = stop - edge;
      if (Math.abs(shift) <= SNAP_PX && (!best || Math.abs(shift) < Math.abs(best.shift))) {
        best = { shift, at: stop };
      }
    }
  }
  return best;
}
