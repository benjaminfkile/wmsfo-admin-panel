import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGN,
  DEFAULT_MAP,
  DEFAULT_ROUTE_STYLE,
  elementPixels,
  parsePosterLayout,
  placementFromPixels,
  snapShift,
  toLayoutDocument,
  type LayoutElement,
} from "./posterLayout";
import { posterSize } from "./poster";
import { ARROW_SCALES, DEFAULT_ARROW_SCALE } from "./posterStyle";

const landscape = posterSize("facebook", "landscape");
const portrait = posterSize("poster", "portrait");

// Each element placed in pixels on a landscape poster.
const PLACED: Array<{ el: LayoutElement; aspect: number }> = [
  {
    el: { type: "image", mediaId: "m-1", ...placementFromPixels({ x: 512, y: 384, width: 614.4, rotation: 30 }, landscape), z: 0 },
    aspect: 0.75,
  },
  {
    el: { type: "logo", mediaId: "m-logo", ...placementFromPixels({ x: 1024, y: 153.6, width: 409.6, rotation: 0 }, landscape), z: 1 },
    aspect: 0.5,
  },
  {
    el: { type: "qr", qrId: 100, tag: "qr-001", ...placementFromPixels({ x: 1843.2, y: 1382.4, width: 307.2, rotation: -90 }, landscape), z: 2 },
    aspect: 1,
  },
];

describe("the poster layout document", () => {
  it("stores every element type with fractional coordinates", () => {
    const doc = toLayoutDocument(DEFAULT_DESIGN, PLACED.map((p) => p.el));
    expect(doc.version).toBe(1);
    expect(doc.elements).toEqual([
      { type: "image", mediaId: "m-1", x: 0.25, y: 0.25, width: 0.3, rotation: 30, z: 0 },
      { type: "logo", mediaId: "m-logo", x: 0.5, y: 0.1, width: 0.2, rotation: 0, z: 1 },
      { type: "qr", qrId: 100, tag: "qr-001", x: 0.9, y: 0.9, width: 0.15, rotation: -90, z: 2 },
    ]);
    for (const el of doc.elements) {
      for (const v of [el.x, el.y, el.width]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("round-trips each element type through JSON and onto another size", () => {
    const doc = toLayoutDocument(
      {
        ...DEFAULT_DESIGN,
        routeStyle: {
          colour: "#aa0011",
          arrows: false,
          arrowScale: 0.75,
          labels: { interval: 30, format: "elapsed", start: null, zone: null },
        },
      },
      PLACED.map((p) => p.el),
    );
    const parsed = parsePosterLayout(JSON.parse(JSON.stringify(doc)));
    expect(parsed).toEqual(doc);
    PLACED.forEach(({ el, aspect }, i) => {
      const back = parsed!.elements[i]!;
      expect(back.type).toBe(el.type);
      // The same fractions land at the same relative spot on a portrait
      // poster, and read back to the same fractions.
      const px = elementPixels(back, portrait, aspect);
      expect(px.x / portrait.width).toBeCloseTo(el.x);
      expect(px.y / portrait.height).toBeCloseTo(el.y);
      expect(px.height).toBeCloseTo(px.width * aspect);
      expect(placementFromPixels(px, portrait)).toEqual({
        x: expect.closeTo(el.x, 9),
        y: expect.closeTo(el.y, 9),
        width: expect.closeTo(el.width, 9),
        rotation: el.rotation,
      });
    });
    expect(parsed!.elements[2]).toMatchObject({ type: "qr", qrId: 100, tag: "qr-001" });
  });

  it("orders by z, drops unknown or incomplete elements, and defaults the route style", () => {
    const parsed = parsePosterLayout({
      version: 1,
      routeStyle: { colour: "red", labels: { interval: 7 } },
      elements: [
        { type: "logo", mediaId: "b", x: 0.1, y: 0.1, width: 0.1, rotation: 0, z: 5 },
        { type: "text", x: 0.1, y: 0.1, width: 0.1, z: 0 },
        { type: "qr", qrId: 1, x: 0.1, y: 0.1, width: 0.1, z: 1 },
        { type: "image", mediaId: "a", x: 0.2, y: 0.2, width: 0.2, z: 2 },
      ],
    });
    expect(parsed!.routeStyle).toEqual(DEFAULT_ROUTE_STYLE);
    expect(parsed).toMatchObject(DEFAULT_MAP);
    expect(parsed!.elements).toEqual([
      { type: "image", mediaId: "a", x: 0.2, y: 0.2, width: 0.2, rotation: 0, z: 0 },
      { type: "logo", mediaId: "b", x: 0.1, y: 0.1, width: 0.1, rotation: 0, z: 1 },
    ]);
    expect(parsePosterLayout(null)).toBeNull();
    expect(parsePosterLayout({ version: 2, elements: [] })).toBeNull();
  });

  it("round-trips every arrow size and reads an absent or unknown one as Large", () => {
    for (const { value } of ARROW_SCALES) {
      const doc = toLayoutDocument(
        { ...DEFAULT_DESIGN, routeStyle: { ...DEFAULT_ROUTE_STYLE, arrowScale: value } },
        [],
      );
      expect(doc.routeStyle.arrowScale).toBe(value);
      expect(parsePosterLayout(JSON.parse(JSON.stringify(doc)))!.routeStyle.arrowScale).toBe(value);
    }
    const absent = { colour: null, arrows: true, labels: { interval: 15, format: "wall" } };
    expect(parsePosterLayout({ version: 1, routeStyle: absent, elements: [] })!.routeStyle.arrowScale).toBe(1.5);
    expect(
      parsePosterLayout({ version: 1, routeStyle: { ...absent, arrowScale: 3 }, elements: [] })!.routeStyle
        .arrowScale,
    ).toBe(1.5);
    expect(DEFAULT_ARROW_SCALE).toBe(1.5);
    expect(DEFAULT_ROUTE_STYLE.arrowScale).toBe(1.5);
  });

  it("round-trips the whole design and defaults an unknown map choice", () => {
    const design = {
      theme: "dark",
      orientation: "portrait",
      size: "poster",
      terrain: true,
      routeStyle: {
        colour: "#123456",
        arrows: true,
        arrowScale: 2,
        labels: { interval: 10, format: "wall", start: "2026-12-21T18:00", zone: "America/Denver" },
      },
    } as const;
    const doc = toLayoutDocument(design, []);
    expect(doc).toEqual({ version: 1, ...design, elements: [] });
    expect(parsePosterLayout(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    const odd = parsePosterLayout({
      version: 1,
      theme: "sepia",
      orientation: "diagonal",
      size: "billboard",
      terrain: "yes",
      routeStyle: { labels: { start: "tomorrow", zone: "" } },
      elements: [],
    });
    expect(odd).toMatchObject(DEFAULT_MAP);
    expect(odd!.routeStyle.labels).toMatchObject({ start: null, zone: null });
  });

  it("snaps the nearest edge or centre within the threshold", () => {
    expect(snapShift([97, 147, 197], [0, 150, 300])).toEqual({ shift: 3, at: 150 });
    expect(snapShift([4, 50, 96], [0, 150, 300])).toEqual({ shift: -4, at: 0 });
    expect(snapShift([20, 60, 100], [0, 150, 300])).toBeNull();
  });
});
