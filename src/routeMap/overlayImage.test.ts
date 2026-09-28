import { afterEach, describe, expect, it, vi } from "vitest";
import { loadOverlayImage, svgDataUrl } from "./overlayImage";

// An image element that loads (or fails) as soon as its src is set.
function stubImage(outcome: "load" | "error", natural = { width: 400, height: 200 }) {
  const created: Array<{ crossOrigin: string | null; src: string }> = [];
  class FakeImage {
    crossOrigin: string | null = null;
    decoding = "auto";
    naturalWidth = natural.width;
    naturalHeight = natural.height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private url = "";
    constructor() {
      created.push(this);
    }
    get src() {
      return this.url;
    }
    set src(v: string) {
      this.url = v;
      if (!v) return;
      setTimeout(() => (outcome === "load" ? this.onload?.() : this.onerror?.()), 0);
    }
  }
  vi.stubGlobal("Image", FakeImage);
  return created;
}

function stubContext(readable: boolean) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => {
      if (!readable) throw new DOMException("The canvas has been tainted.", "SecurityError");
      return {};
    }),
  } as unknown as CanvasRenderingContext2D);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadOverlayImage", () => {
  it("loads with crossOrigin anonymous and reports the aspect", async () => {
    const created = stubImage("load");
    stubContext(true);
    const loaded = await loadOverlayImage("https://cdn.example/a.png");
    expect(created[0]).toMatchObject({ crossOrigin: "anonymous", src: "https://cdn.example/a.png" });
    expect(loaded.aspect).toBe(0.5);
  });

  it("falls back to the given aspect for an svg without an intrinsic size", async () => {
    stubImage("load", { width: 0, height: 0 });
    stubContext(true);
    const loaded = await loadOverlayImage(svgDataUrl("<svg/>"), 0.25);
    expect(loaded.aspect).toBe(0.25);
  });

  it("rejects a tainting image with a readable reason", async () => {
    stubImage("load");
    stubContext(false);
    await expect(loadOverlayImage("https://other.example/a.png")).rejects.toThrow(
      /does not allow the image on a canvas/,
    );
  });

  it("rejects an image that fails to load", async () => {
    stubImage("error");
    stubContext(true);
    await expect(loadOverlayImage("https://cdn.example/missing.png")).rejects.toThrow(
      "The image could not be loaded.",
    );
  });
});
