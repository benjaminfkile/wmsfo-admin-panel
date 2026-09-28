import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATTRIBUTION_TEXT,
  DECODE_CEILING_PIXELS,
  POSTER_PIXEL_RATIO,
  POSTER_PRESETS,
  composePoster,
  fiveMinuteMarks,
  posterFilename,
  posterFitPadding,
  posterSize,
  renderRouteMap,
} from "./poster";
import { ROUTE_ARROW_ICON } from "./style";

type MapOptions = {
  container: HTMLElement;
  pixelRatio: number;
  canvasContextAttributes: { preserveDrawingBuffer: boolean };
  maxCanvasSize: [number, number];
  bounds: unknown;
  fitBoundsOptions: { padding: number };
  style: unknown;
};

const created: MapOptions[] = [];
const removed = vi.fn();
const images: Array<{ id: string; options: unknown }> = [];

vi.mock("maplibre-gl", () => {
  class Map {
    private canvas = document.createElement("canvas");
    constructor(opts: MapOptions) {
      created.push(opts);
      const w = parseFloat(opts.container.style.width);
      const h = parseFloat(opts.container.style.height);
      this.canvas.width = Math.floor(w * opts.pixelRatio);
      this.canvas.height = Math.floor(h * opts.pixelRatio);
    }
    once(type: string, cb: () => void) {
      if (type === "idle") setTimeout(cb, 0);
      return this;
    }
    on() {
      return this;
    }
    hasImage(id: string) {
      return images.some((i) => i.id === id);
    }
    addImage(id: string, _data: unknown, options: unknown) {
      images.push({ id, options });
    }
    getCanvas() {
      return this.canvas;
    }
    remove() {
      removed();
    }
  }
  return { Map, addProtocol: vi.fn(), setWorkerUrl: vi.fn() };
});

vi.mock("pmtiles", () => ({
  Protocol: class {
    tile = vi.fn();
  },
}));

function fakeContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn((t: string) => ({ width: t.length * 10 })),
    font: "",
    fillStyle: "",
    textBaseline: "",
    textAlign: "",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  created.length = 0;
  images.length = 0;
  removed.mockClear();
});

describe("poster presets", () => {
  it("keeps the three presets and their pairs", () => {
    expect(POSTER_PRESETS).toEqual([
      { id: "facebook", label: "Facebook post", width: 2048, height: 1536 },
      { id: "flyer", label: "Flyer, letter at 300 dpi", width: 2550, height: 3300 },
      { id: "poster", label: "Poster, 11 x 17 at 300 dpi", width: 3300, height: 5100 },
    ]);
  });

  it("each preset and orientation produces the documented pixel size", () => {
    expect(posterSize("facebook", "landscape")).toEqual({ width: 2048, height: 1536 });
    expect(posterSize("facebook", "portrait")).toEqual({ width: 1536, height: 2048 });
    expect(posterSize("flyer", "portrait")).toEqual({ width: 2550, height: 3300 });
    expect(posterSize("flyer", "landscape")).toEqual({ width: 3300, height: 2550 });
    expect(posterSize("poster", "portrait")).toEqual({ width: 3300, height: 5100 });
    expect(posterSize("poster", "landscape")).toEqual({ width: 5100, height: 3300 });
  });

  it("every preset stays under the 40 megapixel decode ceiling and divides by the pixel ratio", () => {
    for (const p of POSTER_PRESETS) {
      expect(p.width * p.height).toBeLessThan(DECODE_CEILING_PIXELS);
      expect(p.width % POSTER_PIXEL_RATIO).toBe(0);
      expect(p.height % POSTER_PIXEL_RATIO).toBe(0);
    }
  });

  it("names the file by year, theme, and size", () => {
    expect(posterFilename(2026, "dark", { width: 2550, height: 3300 })).toBe(
      "route-poster-2026-dark-2550x3300.jpg",
    );
  });

  it("marks every whole 5 minutes between the start and the end", () => {
    const marks = fiveMinuteMarks({
      path: [],
      durationMinutes: 15,
      timeline: [
        { minutes: 0, lat: 1, lng: 1 },
        { minutes: 5, lat: 2, lng: 2 },
        { minutes: 7, lat: 9, lng: 9 },
        { minutes: 10, lat: 3, lng: 3 },
        { minutes: 15, lat: 4, lng: 4 },
      ],
    });
    expect(marks).toEqual([
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 },
    ]);
  });
});

describe("composePoster", () => {
  it("draws the map and the attribution text into the composed canvas", () => {
    const ctx = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const map = document.createElement("canvas");
    const out = composePoster(map, { width: 2048, height: 1536 }, "light");
    expect(out.width).toBe(2048);
    expect(out.height).toBe(1536);
    expect(ctx.drawImage).toHaveBeenCalledWith(map, 0, 0, 2048, 1536);
    expect(ATTRIBUTION_TEXT).toBe("© OpenStreetMap contributors");
    expect(ctx.fillText).toHaveBeenCalledWith(
      ATTRIBUTION_TEXT,
      expect.any(Number),
      expect.any(Number),
    );
    const [, x, y] = ctx.fillText.mock.calls[0]!;
    expect(x).toBeGreaterThan(1024);
    expect(y).toBeGreaterThan(768);
    expect(y).toBeLessThan(1536);
  });
});

describe("renderRouteMap", () => {
  it("renders with an explicit pixel ratio and preserveDrawingBuffer to exactly the chosen size", async () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true });
    const { canvas, dispose } = await renderRouteMap({
      style: { version: 8, sources: {}, layers: [] },
      path: [
        { lat: 46.8, lng: -114.1 },
        { lat: 46.9, lng: -114.0 },
      ],
      size: { width: 3300, height: 5100 },
    });
    expect(canvas.width).toBe(3300);
    expect(canvas.height).toBe(5100);
    const maplibre = await import("maplibre-gl");
    expect(maplibre.setWorkerUrl).toHaveBeenCalledWith(expect.any(String));
    const opts = created[0]!;
    expect(opts.pixelRatio).toBe(POSTER_PIXEL_RATIO);
    expect(opts.canvasContextAttributes.preserveDrawingBuffer).toBe(true);
    expect(opts.maxCanvasSize).toEqual([3300, 5100]);
    expect(opts.bounds).toEqual([
      [-114.1, 46.8],
      [-114.0, 46.9],
    ]);
    expect(opts.fitBoundsOptions.padding).toBe(posterFitPadding({ width: 3300, height: 5100 }));
    expect(images).toEqual([{ id: ROUTE_ARROW_ICON, options: { sdf: true, pixelRatio: 2 } }]);
    dispose();
    expect(removed).toHaveBeenCalled();
    expect(opts.container.isConnected).toBe(false);
  });

  it("refuses an empty path", async () => {
    await expect(
      renderRouteMap({
        style: { version: 8, sources: {}, layers: [] },
        path: [],
        size: { width: 2048, height: 1536 },
      }),
    ).rejects.toThrow(/no path/);
  });
});
