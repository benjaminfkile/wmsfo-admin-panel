import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGN,
  DEFAULT_DETAILS,
  DEFAULT_MAP,
  DEFAULT_ROUTE_STYLE,
  defaultPosterLayout,
  elementPixels,
  layoutChoices,
  parsePosterLayout,
  placementFromPixels,
  snapShift,
  toLayoutDocument,
  type LayoutChoices,
  type LayoutElement,
} from "./posterLayout";
import { posterSize } from "./poster";
import { ARROW_SCALES, DEFAULT_ARROW_SCALE } from "./posterStyle";

// route-light (1) and route-dark (2) seeds and one theme of the admin's
// own; the Missoula valley map (1) and another (3).
const CHOICES: LayoutChoices = {
  themes: [
    { id: 1, key: "route-light" },
    { id: 2, key: "route-dark" },
    { id: 9, key: "harbour" },
  ],
  maps: [{ id: 1 }, { id: 3 }],
  defaultThemeId: 1,
  defaultMapId: 1,
};

const parse = (raw: unknown) => parsePosterLayout(raw, CHOICES)?.layout ?? null;

// The default design with an offered theme and map.
const DESIGN = { ...DEFAULT_DESIGN, themeId: 9, mapId: 3 };

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
        ...DESIGN,
        routeStyle: {
          colour: "#aa0011",
          arrows: false,
          arrowScale: 0.75,
          labels: { interval: 30, format: "elapsed", start: null, zone: null },
        },
      },
      PLACED.map((p) => p.el),
    );
    const parsed = parse(JSON.parse(JSON.stringify(doc)));
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
    const parsed = parse({
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
    expect(parsed).toMatchObject({ ...DEFAULT_MAP, themeId: 1, mapId: 1 });
    expect(parsed!.elements).toEqual([
      { type: "image", mediaId: "a", x: 0.2, y: 0.2, width: 0.2, rotation: 0, z: 0 },
      { type: "logo", mediaId: "b", x: 0.1, y: 0.1, width: 0.1, rotation: 0, z: 1 },
    ]);
    expect(parse(null)).toBeNull();
    expect(parse({ version: 2, elements: [] })).toBeNull();
  });

  it("round-trips every arrow size and reads an absent or unknown one as Large", () => {
    for (const { value } of ARROW_SCALES) {
      const doc = toLayoutDocument(
        { ...DESIGN, routeStyle: { ...DEFAULT_ROUTE_STYLE, arrowScale: value } },
        [],
      );
      expect(doc.routeStyle.arrowScale).toBe(value);
      expect(parse(JSON.parse(JSON.stringify(doc)))!.routeStyle.arrowScale).toBe(value);
    }
    const absent = { colour: null, arrows: true, labels: { interval: 15, format: "wall" } };
    expect(parse({ version: 1, routeStyle: absent, elements: [] })!.routeStyle.arrowScale).toBe(1.5);
    expect(
      parse({ version: 1, routeStyle: { ...absent, arrowScale: 3 }, elements: [] })!.routeStyle
        .arrowScale,
    ).toBe(1.5);
    expect(DEFAULT_ARROW_SCALE).toBe(1.5);
    expect(DEFAULT_ROUTE_STYLE.arrowScale).toBe(1.5);
  });

  it("round-trips the whole design and defaults an unknown map choice", () => {
    const design = {
      themeId: 2,
      mapId: 3,
      orientation: "portrait",
      size: "poster",
      terrain: true,
      details: { landmarks: false, placeNames: true, roadLabels: false },
      routeStyle: {
        colour: "#123456",
        arrows: true,
        arrowScale: 2,
        labels: { interval: 10, format: "wall", start: "2026-12-21T18:00", zone: "America/Denver" },
      },
    } as const;
    const doc = toLayoutDocument(design, []);
    expect(doc).toEqual({ version: 1, ...design, elements: [] });
    expect(parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    const odd = parse({
      version: 1,
      themeId: "sepia",
      mapId: 3.5,
      orientation: "diagonal",
      size: "billboard",
      terrain: "yes",
      routeStyle: { labels: { start: "tomorrow", zone: "" } },
      elements: [],
    });
    expect(odd).toMatchObject({ ...DEFAULT_MAP, themeId: 1, mapId: 1 });
    expect(odd!.routeStyle.labels).toMatchObject({ start: null, zone: null });
  });

  it("defaults every map detail on and round-trips each switch, absent meaning on", () => {
    expect(DEFAULT_DETAILS).toEqual({ landmarks: true, placeNames: true, roadLabels: true });
    expect(toLayoutDocument(DEFAULT_DESIGN, []).details).toEqual(DEFAULT_DETAILS);
    for (const key of ["landmarks", "placeNames", "roadLabels"] as const) {
      const details = { ...DEFAULT_DETAILS, [key]: false };
      const doc = toLayoutDocument({ ...DESIGN, details }, []);
      expect(doc.details).toEqual(details);
      expect(parse(JSON.parse(JSON.stringify(doc)))!.details).toEqual(details);
    }
    // A document saved without details, or with some of them, reads the
    // missing switches as on; anything but false reads on.
    expect(parse({ version: 1, elements: [] })!.details).toEqual(DEFAULT_DETAILS);
    expect(
      parse({ version: 1, details: { roadLabels: false }, elements: [] })!.details,
    ).toEqual({ landmarks: true, placeNames: true, roadLabels: false });
    expect(
      parse({ version: 1, details: { landmarks: "no", placeNames: null }, elements: [] })!
        .details,
    ).toEqual(DEFAULT_DETAILS);
  });

  it("round-trips a document of either form, the old one onto the seed rows", () => {
    const doc = toLayoutDocument({ ...DESIGN, themeId: 2, mapId: 3 }, []);
    expect(doc).toMatchObject({ themeId: 2, mapId: 3 });
    expect(doc).not.toHaveProperty("theme");
    expect(parsePosterLayout(JSON.parse(JSON.stringify(doc)), CHOICES)).toEqual({
      layout: doc,
      replaced: false,
    });

    // A document saved before themes were rows: `theme` in place of the
    // ids, mapped to the seed by key, the map the default, and the
    // notice raised. Saving it writes the new form, which reads back as is.
    const old = { ...doc, theme: "dark", themeId: undefined, mapId: undefined };
    const read = parsePosterLayout(JSON.parse(JSON.stringify(old)), CHOICES)!;
    expect(read.replaced).toBe(true);
    expect(read.layout).toEqual({ ...doc, themeId: 2, mapId: 1 });
    expect(parsePosterLayout({ version: 1, theme: "light", elements: [] }, CHOICES)!.layout)
      .toMatchObject({ themeId: 1, mapId: 1 });
    const saved = toLayoutDocument(read.layout, read.layout.elements);
    expect(parsePosterLayout(JSON.parse(JSON.stringify(saved)), CHOICES)).toEqual({
      layout: saved,
      replaced: false,
    });
  });

  it("reads a deleted seed of the old form as the default theme", () => {
    const choices = { ...CHOICES, themes: [{ id: 9, key: "harbour" }], defaultThemeId: 9 };
    const read = parsePosterLayout({ version: 1, theme: "dark", mapId: 3, elements: [] }, choices)!;
    expect(read.layout).toMatchObject({ themeId: 9, mapId: 3 });
    expect(read.replaced).toBe(true);
  });

  it("reads a missing or deleted theme or map as its default with the notice", () => {
    const cases: Array<[Record<string, unknown>, { themeId: number; mapId: number }]> = [
      [{ mapId: 3 }, { themeId: 1, mapId: 3 }],
      [{ themeId: 9 }, { themeId: 9, mapId: 1 }],
      [{ themeId: 42, mapId: 3 }, { themeId: 1, mapId: 3 }],
      [{ themeId: 9, mapId: 42 }, { themeId: 9, mapId: 1 }],
    ];
    for (const [ids, expected] of cases) {
      const read = parsePosterLayout({ version: 1, ...ids, elements: [] }, CHOICES)!;
      expect(read.layout).toMatchObject(expected);
      expect(read.replaced).toBe(true);
    }
    expect(parsePosterLayout({ version: 1, themeId: 9, mapId: 3, elements: [] }, CHOICES)!.replaced)
      .toBe(false);
  });

  it("opens a poster without a layout on the defaults", () => {
    expect(defaultPosterLayout(CHOICES)).toEqual(
      toLayoutDocument({ ...DEFAULT_DESIGN, themeId: 1, mapId: 1 }, []),
    );
  });

  it("picks the light default theme and the map of the newest event flying the recording", () => {
    const theme = (id: number, light: boolean) =>
      ({ id, key: `t${id}`, renderer: "maplibre", defaultLightMode: light });
    const map = (id: number, prefix: string) => ({ id, prefix, state: "ready" });
    const themes = [theme(4, false), theme(5, true)];
    const maps = [map(3, "maps/3"), map(1, "basemap"), map(6, "maps/6")];
    const events = [
      { year: 2024, routeId: 7, trackerMapId: 3 },
      { year: 2025, routeId: 7, trackerMapId: 6 },
      { year: 2026, routeId: 8, trackerMapId: 3 },
    ];
    expect(layoutChoices(themes, maps, events, 7)).toMatchObject({ defaultThemeId: 5, defaultMapId: 6 });
    expect(layoutChoices(themes, maps, events, 9).defaultMapId).toBe(1);
    expect(layoutChoices(themes, maps, events, null).defaultMapId).toBe(1);
    expect(layoutChoices([theme(4, false)], [map(3, "maps/3")], [], null)).toMatchObject({
      defaultThemeId: 4,
      defaultMapId: 3,
    });
    expect(layoutChoices([], [], [], null)).toMatchObject({ defaultThemeId: null, defaultMapId: null });
  });

  it("snaps the nearest edge or centre within the threshold", () => {
    expect(snapShift([97, 147, 197], [0, 150, 300])).toEqual({ shift: 3, at: 150 });
    expect(snapShift([4, 50, 96], [0, 150, 300])).toEqual({ shift: -4, at: 0 });
    expect(snapShift([20, 60, 100], [0, 150, 300])).toBeNull();
  });
});
