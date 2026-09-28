// Route poster generation: the size presets, the marks drawn on the path,
// the offscreen MapLibre render at an exact pixel size, and the composed
// JPEG: the map, then the overlays, then the OpenStreetMap attribution
// drawn into its pixels.

import type { StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Appearance } from "./flavors";
import {
  OSM_ATTRIBUTION,
  ROUTE_ARROW_ICON,
  makeRouteArrowImage,
  pathBounds,
  terrainUrl,
  type LatLng,
  type RouteArrowImage,
} from "./style";

export type PosterPresetId = "facebook" | "flyer" | "poster";
export type PosterOrientation = "portrait" | "landscape";

export type PosterPreset = {
  id: PosterPresetId;
  label: string;
  // The documented pair; the orientation decides which side is the width.
  width: number;
  height: number;
};

export const POSTER_PRESETS: readonly PosterPreset[] = [
  { id: "facebook", label: "Facebook post", width: 2048, height: 1536 },
  { id: "flyer", label: "Flyer, letter at 300 dpi", width: 2550, height: 3300 },
  { id: "poster", label: "Poster, 11 x 17 at 300 dpi", width: 3300, height: 5100 },
];

// The API decodes rasters up to 40 megapixels; every preset stays under it.
export const DECODE_CEILING_PIXELS = 40_000_000;

// The pixel ratio of the offscreen map: the CSS size of the map is the
// chosen size divided by this, so labels and lines read the same at every
// output size whatever the admin's screen is.
export const POSTER_PIXEL_RATIO = 2;

export type PosterSize = { width: number; height: number };

// The CSS size of the poster map: the chosen size over POSTER_PIXEL_RATIO.
export function posterCssSize(size: PosterSize): PosterSize {
  return { width: size.width / POSTER_PIXEL_RATIO, height: size.height / POSTER_PIXEL_RATIO };
}

// The padding around the fitted path, in CSS pixels: 8% of the shorter
// side of the poster map.
export function posterFitPadding(size: PosterSize): number {
  const css = posterCssSize(size);
  return Math.round(Math.min(css.width, css.height) * 0.08);
}

export function posterPreset(id: PosterPresetId): PosterPreset {
  const preset = POSTER_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown poster preset ${id}`);
  return preset;
}

// Portrait puts the longer side vertical, landscape puts it horizontal.
export function posterSize(
  id: PosterPresetId,
  orientation: PosterOrientation,
): PosterSize {
  const { width, height } = posterPreset(id);
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  return orientation === "portrait"
    ? { width: short, height: long }
    : { width: long, height: short };
}

export function posterFilename(
  year: number,
  theme: Appearance,
  size: PosterSize,
): string {
  return `route-poster-${year}-${theme}-${size.width}x${size.height}.jpg`;
}

// The poster export encoding. JPEG, because the terrain hillshade makes a
// print-size PNG pass the 20 MB media limit, while a JPEG at this quality
// is a few MB and indistinguishable at 300 dpi. The type and quality ride
// together into every encode and upload.
export const POSTER_MIME = "image/jpeg";
export const POSTER_JPEG_QUALITY = 0.92;

export type RouteMapData = {
  path: readonly LatLng[];
  timeline: readonly { minutes: number; lat: number; lng: number }[];
  durationMinutes: number;
};

// The timeline points at every whole 5 minutes strictly between the start
// and the end; the start and end markers stand for the two ends.
export function fiveMinuteMarks(routeMap: RouteMapData): LatLng[] {
  return routeMap.timeline
    .filter(
      (t) =>
        t.minutes > 0 &&
        t.minutes < routeMap.durationMinutes &&
        t.minutes % 5 === 0,
    )
    .map((t) => ({ lat: t.lat, lng: t.lng }));
}

// The attribution text without its link markup.
export const ATTRIBUTION_TEXT = OSM_ATTRIBUTION.replace(/<[^>]*>/g, "");

const CHIP_COLORS: Record<Appearance, { fill: string; text: string }> = {
  light: { fill: "rgba(255, 255, 255, 0.85)", text: "#202124" },
  dark: { fill: "rgba(15, 26, 43, 0.85)", text: "#f2f6ff" },
};

// Draws the attribution as a rounded chip in the bottom right corner. The
// font scales with the image so it stays legible in print and on a phone.
export function drawAttribution(
  ctx: CanvasRenderingContext2D,
  size: PosterSize,
  theme: Appearance,
): void {
  const fontPx = Math.max(14, Math.round(Math.min(size.width, size.height) / 80));
  const padX = Math.round(fontPx * 0.6);
  const padY = Math.round(fontPx * 0.35);
  const margin = Math.round(fontPx * 0.8);
  ctx.save();
  ctx.font = `${fontPx}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const textWidth = Math.ceil(ctx.measureText(ATTRIBUTION_TEXT).width);
  const chipW = textWidth + padX * 2;
  const chipH = fontPx + padY * 2;
  const x = size.width - margin - chipW;
  const y = size.height - margin - chipH;
  const colors = CHIP_COLORS[theme];
  ctx.fillStyle = colors.fill;
  ctx.beginPath();
  ctx.roundRect(x, y, chipW, chipH, Math.round(chipH / 2));
  ctx.fill();
  ctx.fillStyle = colors.text;
  ctx.fillText(ATTRIBUTION_TEXT, x + padX, y + chipH / 2);
  ctx.restore();
}

// Draws the map canvas onto a fresh 2D canvas of the chosen size, the
// overlay canvas (when there is one) over it at the same size, and the
// attribution chip last, so nothing covers it.
export function composePoster(
  mapCanvas: HTMLCanvasElement,
  size: PosterSize,
  theme: Appearance,
  overlay: CanvasImageSource | null = null,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the poster image.");
  ctx.drawImage(mapCanvas, 0, 0, size.width, size.height);
  if (overlay) ctx.drawImage(overlay, 0, 0, size.width, size.height);
  drawAttribution(ctx, size, theme);
  return canvas;
}

export function canvasToPosterBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The poster image could not be encoded."));
      },
      POSTER_MIME,
      POSTER_JPEG_QUALITY,
    );
  });
}

let arrowImage: RouteArrowImage | null = null;

type ArrowImageHost = Pick<import("maplibre-gl").Map, "addImage" | "hasImage" | "on">;

// Adds the route arrowhead under ROUTE_ARROW_ICON to a new map, and adds it
// again whenever a style replacement leaves the map without it.
export function addRouteArrowImage(map: ArrowImageHost): void {
  const add = () => {
    if (map.hasImage(ROUTE_ARROW_ICON)) return;
    arrowImage ??= makeRouteArrowImage();
    map.addImage(ROUTE_ARROW_ICON, arrowImage.data, arrowImage.options);
  };
  add();
  map.on("styleimagemissing", (e: { id: string }) => {
    if (e.id === ROUTE_ARROW_ICON) add();
  });
}

let protocolReady: Promise<void> | null = null;

// Registers the pmtiles:// protocol with MapLibre once per page.
function ensurePmtilesProtocol(
  addProtocol: typeof import("maplibre-gl").addProtocol,
): Promise<void> {
  if (!protocolReady) {
    protocolReady = import("pmtiles").then(({ Protocol }) => {
      addProtocol("pmtiles", new Protocol().tile);
    });
  }
  return protocolReady;
}

const terrainProbes = new Map<string, Promise<boolean>>();

// Reads the header of `<base>/terrain.pmtiles` once per base per page
// load, on the first call, and resolves whether the archive exists. A
// missing or failing archive logs once and resolves false.
export function probeTerrain(base: string): Promise<boolean> {
  let probe = terrainProbes.get(base);
  if (!probe) {
    probe = import("pmtiles")
      .then(({ PMTiles }) => new PMTiles(terrainUrl(base)).getHeader())
      .then(() => true)
      .catch((error: unknown) => {
        console.warn("route poster: no terrain archive, the terrain option is hidden", error);
        return false;
      });
    terrainProbes.set(base, probe);
  }
  return probe;
}

// Forgets every probe result (tests only).
export function resetTerrainProbes(): void {
  terrainProbes.clear();
}

export const RENDER_TIMEOUT_MS = 60_000;

// Loads maplibre-gl on demand with its worker and the pmtiles:// protocol.
export async function loadMaplibre(): Promise<typeof import("maplibre-gl")> {
  const maplibre = await import("maplibre-gl");
  // The worker file must be a build asset of this application; without the
  // pinned URL the deployed bundle has no worker and the map never loads.
  maplibre.setWorkerUrl(workerUrl);
  await ensurePmtilesProtocol(maplibre.addProtocol);
  return maplibre;
}

// Renders the style into an offscreen map whose canvas is exactly the
// chosen size, fitted to the path with padding, with the route arrowhead
// image added on create, and resolves with the map
// canvas once the map is idle. The caller composes it before calling the
// returned dispose.
export async function renderRouteMap(opts: {
  style: StyleSpecification;
  path: readonly LatLng[];
  size: PosterSize;
}): Promise<{ canvas: HTMLCanvasElement; dispose: () => void }> {
  const bounds = pathBounds(opts.path);
  if (!bounds) throw new Error("The flight recording has no path to draw.");
  const maplibre = await loadMaplibre();

  const ratio = POSTER_PIXEL_RATIO;
  const { width: cssW, height: cssH } = posterCssSize(opts.size);
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  Object.assign(container.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${cssW}px`,
    height: `${cssH}px`,
    pointerEvents: "none",
  });
  document.body.appendChild(container);

  let map: import("maplibre-gl").Map | null = null;
  const dispose = () => {
    map?.remove();
    map = null;
    container.remove();
  };

  try {
    const padding = posterFitPadding(opts.size);
    const created = new maplibre.Map({
      container,
      style: opts.style,
      interactive: false,
      attributionControl: false,
      pixelRatio: ratio,
      maxCanvasSize: [opts.size.width, opts.size.height],
      canvasContextAttributes: { preserveDrawingBuffer: true },
      fadeDuration: 0,
      bounds,
      fitBoundsOptions: { padding },
    });
    map = created;
    addRouteArrowImage(created);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The map took too long to load.")),
        RENDER_TIMEOUT_MS,
      );
      created.once("idle", () => {
        clearTimeout(timer);
        resolve();
      });
      created.on("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`The map could not load: ${e.error?.message ?? "unknown error"}`));
      });
    });
    const canvas = created.getCanvas();
    if (canvas.width !== opts.size.width || canvas.height !== opts.size.height) {
      throw new Error(
        `This browser drew the map at ${canvas.width} x ${canvas.height} instead of ${opts.size.width} x ${opts.size.height}. Try a smaller size or another browser.`,
      );
    }
    return { canvas, dispose };
  } catch (e) {
    dispose();
    throw e;
  }
}

// Renders, composes, and encodes the poster image at exactly the chosen
// size, with the overlay canvas (already at the print scale) over the map.
export async function renderPosterImage(opts: {
  style: StyleSpecification;
  path: readonly LatLng[];
  size: PosterSize;
  theme: Appearance;
  overlay?: CanvasImageSource | null;
}): Promise<Blob> {
  const { canvas, dispose } = await renderRouteMap(opts);
  try {
    const composed = composePoster(canvas, opts.size, opts.theme, opts.overlay ?? null);
    return await canvasToPosterBlob(composed);
  } finally {
    dispose();
  }
}
