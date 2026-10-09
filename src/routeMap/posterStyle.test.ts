import { describe, expect, it } from "vitest";
import {
  buildPosterStyle,
  formatElapsed,
  formatWallClock,
  isHexColor,
  posterTimeLabels,
  themeRouteColor,
  timeLabelEntries,
} from "./posterStyle";
import type { StyleSpecification } from "maplibre-gl";
import themeSeed from "../../contracts/fixtures/themes/seed.json";
import routeLightStyle from "../../contracts/fixtures/themes/route-light.json";
import routeDarkStyle from "../../contracts/fixtures/themes/route-dark.json";
import {
  ARROWS_LAYER,
  DETAIL_LAYERS,
  ENDS_LAYER,
  MARKS_LAYER,
  ROUTE_LAYER,
  TIME_LABELS_LAYER,
  TIME_LABELS_SOURCE,
  TIME_LABEL_DOTS_LAYER,
} from "./routeLayers";

const seed = (key: string) => themeSeed.find((t) => t.key === key)!;
const LIGHT = { overlay: seed("route-light").overlay, body: routeLightStyle as StyleSpecification };
const DARK = { overlay: seed("route-dark").overlay, body: routeDarkStyle as StyleSpecification };
const MAP = {
  tilesUrl: "https://cdn.example/maps/7/tiles.pmtiles",
  terrainUrl: "https://cdn.example/maps/7/terrain.pmtiles",
};
const FLAT_MAP = { tilesUrl: "https://cdn.example/maps/8/tiles.pmtiles", terrainUrl: null };

type Painted = { paint?: Record<string, unknown>; layout?: Record<string, unknown> };

// A 47 minute flight with an entry every minute.
const TIMELINE = Array.from({ length: 48 }, (_, minutes) => ({
  minutes,
  lat: 46 + minutes / 100,
  lng: -114 - minutes / 100,
}));

describe("time label entries", () => {
  it("picks every whole interval and always the final entry", () => {
    expect(timeLabelEntries(TIMELINE, 15).map((t) => t.minutes)).toEqual([0, 15, 30, 45, 47]);
    expect(timeLabelEntries(TIMELINE, 30).map((t) => t.minutes)).toEqual([0, 30, 47]);
    expect(timeLabelEntries(TIMELINE, 10).map((t) => t.minutes)).toEqual([0, 10, 20, 30, 40, 47]);
  });

  it("lists the final entry once when it falls on the interval", () => {
    const timeline = TIMELINE.slice(0, 46);
    expect(timeLabelEntries(timeline, 5).map((t) => t.minutes)).toEqual([
      0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
    ]);
  });

  it("yields nothing when the labels are off or the timeline is empty", () => {
    expect(timeLabelEntries(TIMELINE, 0)).toEqual([]);
    expect(timeLabelEntries([], 15)).toEqual([]);
  });
});

describe("time label formats", () => {
  it("formats elapsed time as minutes under an hour and hours plus minutes from one", () => {
    expect(formatElapsed(0)).toBe("0m");
    expect(formatElapsed(45)).toBe("45m");
    expect(formatElapsed(59.6)).toBe("1h 0m");
    expect(formatElapsed(60)).toBe("1h 0m");
    expect(formatElapsed(75)).toBe("1h 15m");
    expect(formatElapsed(125)).toBe("2h 5m");
    expect(formatElapsed(-3)).toBe("0m");
  });

  it("formats the wall clock in the event's schedule zone", () => {
    // 2026-12-24T01:00Z is 18:00 in Denver (MST) and 19:00 in Chicago (CST).
    expect(formatWallClock("2026-12-24T01:00:00Z", 15, "America/Denver")).toBe("6:15 PM");
    expect(formatWallClock("2026-12-24T01:00:00Z", 15, "America/Chicago")).toBe("7:15 PM");
  });

  it("follows the zone across a daylight saving change", () => {
    // Denver falls back at 02:00 MDT on 2026-11-01 (08:00Z).
    expect(formatWallClock("2026-11-01T07:30:00Z", 0, "America/Denver")).toBe("1:30 AM");
    expect(formatWallClock("2026-11-01T07:30:00Z", 45, "America/Denver")).toBe("1:15 AM");
  });

  it("labels the entries as wall clock or elapsed", () => {
    const settings = {
      interval: 30 as const,
      scheduledAt: "2026-12-24T01:00:00Z",
      zone: "America/Denver",
    };
    expect(posterTimeLabels(TIMELINE, { ...settings, format: "wall" })).toEqual([
      { lat: 46, lng: -114, label: "6:00 PM" },
      { lat: 46.3, lng: -114.3, label: "6:30 PM" },
      { lat: 46.47, lng: -114.47, label: "6:47 PM" },
    ]);
    expect(
      posterTimeLabels(TIMELINE, { ...settings, format: "elapsed" }).map((l) => l.label),
    ).toEqual(["0m", "30m", "47m"]);
  });

  it("falls back to elapsed labels without a scheduled time", () => {
    expect(
      posterTimeLabels(TIMELINE, {
        interval: 30,
        format: "wall",
        scheduledAt: null,
        zone: "America/Denver",
      }).map((l) => l.label),
    ).toEqual(["0m", "30m", "47m"]);
  });
});

describe("buildPosterStyle", () => {
  const routeMap = {
    path: TIMELINE.map(({ lat, lng }) => ({ lat, lng })),
    timeline: TIMELINE,
    durationMinutes: 47,
  };
  const layer = (style: StyleSpecification, id: string) =>
    style.layers.find((l) => l.id === id) as Painted;

  it("draws the theme body over the map row and the route over it", () => {
    const style = buildPosterStyle({ theme: LIGHT, map: MAP, routeMap, terrain: false, options: {} });
    expect(style.sources.basemap).toMatchObject({ url: `pmtiles://${MAP.tilesUrl}` });
    expect(style.glyphs).toBe(LIGHT.body.glyphs);
    const ids = style.layers.map((l) => l.id);
    const themeIds = routeLightStyle.layers
      .filter((l) => (l as { source?: string }).source !== "terrain")
      .map((l) => l.id);
    expect(ids.slice(0, themeIds.length)).toEqual(themeIds);
    expect(ids.slice(themeIds.length)).toEqual([ROUTE_LAYER, MARKS_LAYER, ENDS_LAYER]);
  });

  it("colours the route, the arrows, the marks, and the labels from the theme's overlay", () => {
    for (const [theme, key] of [[LIGHT, "route-light"], [DARK, "route-dark"]] as const) {
      const overlay = seed(key).overlay;
      const style = buildPosterStyle({
        theme,
        map: MAP,
        routeMap,
        terrain: false,
        options: { arrows: true, timeLabels: [{ lat: 46, lng: -114, label: "0m" }] },
      });
      expect(layer(style, ROUTE_LAYER).paint).toMatchObject({
        "line-color": overlay.routeColor,
        "line-opacity": overlay.routeOpacity,
      });
      expect(layer(style, ARROWS_LAYER).paint?.["icon-color"]).toBe(overlay.arrowColor);
      expect(layer(style, MARKS_LAYER).paint).toMatchObject({
        "circle-color": overlay.timeLabelBg,
        "circle-stroke-color": overlay.routeColor,
      });
      expect(layer(style, TIME_LABELS_LAYER).paint).toMatchObject({
        "text-color": overlay.timeLabelFg,
        "text-halo-color": overlay.timeLabelBg,
        "text-opacity": overlay.timeLabelOpacity,
      });
    }
  });

  it("draws the picked colour, the arrows, and the time labels", () => {
    const style = buildPosterStyle({
      theme: LIGHT,
      map: MAP,
      routeMap,
      terrain: false,
      options: {
        routeColor: "#ff0000",
        arrows: true,
        timeLabels: [{ lat: 46, lng: -114, label: "0m" }],
      },
    });
    const ids = style.layers.map((l) => l.id);
    expect(layer(style, ROUTE_LAYER).paint?.["line-color"]).toBe("#ff0000");
    expect(layer(style, ARROWS_LAYER).paint?.["icon-color"]).toBe("#ff0000");
    expect(ids).toContain(TIME_LABELS_LAYER);
    expect(style.sources[TIME_LABELS_SOURCE]).toBeDefined();
  });

  it("leaves the arrows and labels out when they are off", () => {
    const style = buildPosterStyle({
      theme: DARK,
      map: MAP,
      routeMap,
      terrain: false,
      options: { arrows: false, timeLabels: [] },
    });
    const ids = style.layers.map((l) => l.id);
    expect(ids).not.toContain(ARROWS_LAYER);
    expect(ids).not.toContain(TIME_LABELS_LAYER);
  });

  it("draws the hillshade only with terrain on a map with a terrain file", () => {
    const hillshade = (style: StyleSpecification) =>
      style.layers.filter((l) => (l as { source?: string }).source === "terrain").map((l) => l.id);
    const shaded = buildPosterStyle({ theme: LIGHT, map: MAP, routeMap, terrain: true, options: {} });
    expect(hillshade(shaded)).toEqual(["terrain-hillshade"]);
    expect(shaded.sources.terrain).toMatchObject({ url: `pmtiles://${MAP.terrainUrl}` });
    for (const [map, terrain] of [[MAP, false], [FLAT_MAP, true]] as const) {
      const flat = buildPosterStyle({ theme: LIGHT, map, routeMap, terrain, options: {} });
      expect(hillshade(flat)).toEqual([]);
      expect(flat.sources.terrain).toBeUndefined();
    }
  });

  it("drops the seed layers of each detail group turned off and keeps the rest", () => {
    const all = buildPosterStyle({ theme: LIGHT, map: MAP, routeMap, terrain: false, options: {} })
      .layers.map((l) => l.id);
    for (const group of ["landmarks", "placeNames", "roadLabels"] as const) {
      for (const id of DETAIL_LAYERS[group]) expect(all).toContain(id);
      const ids = buildPosterStyle({
        theme: LIGHT,
        map: MAP,
        routeMap,
        terrain: false,
        options: { details: { [group]: false } },
      }).layers.map((l) => l.id);
      expect(ids).toEqual(all.filter((id) => !DETAIL_LAYERS[group].includes(id)));
    }
  });

  it("drops every layer marked wmsfo:places with Landmarks off", () => {
    const body: StyleSpecification = {
      ...LIGHT.body,
      layers: [
        ...LIGHT.body.layers,
        {
          id: "my-places",
          type: "symbol",
          source: "basemap",
          "source-layer": "pois",
          metadata: { "wmsfo:places": true },
        },
      ],
    };
    const ids = (landmarks: boolean) =>
      buildPosterStyle({
        theme: { ...LIGHT, body },
        map: MAP,
        routeMap,
        terrain: false,
        options: { details: { landmarks } },
      }).layers.map((l) => l.id);
    expect(ids(true)).toContain("my-places");
    expect(ids(false)).not.toContain("my-places");
  });
});

describe("the poster's label sizes", () => {
  const routeMap = {
    path: TIMELINE.map(({ lat, lng }) => ({ lat, lng })),
    timeline: TIMELINE,
    durationMinutes: 47,
  };

  // The poster's labels: 20 px times at every zoom, their dots on their
  // own zoom stops.
  it("keeps the full label sizes at every zoom whatever label options it is given", () => {
    for (const extra of [{}, { labelScale: 1.3 }, { labelCurve: "zoom" as const }]) {
      const style = buildPosterStyle({
        theme: LIGHT,
        map: MAP,
        routeMap,
        terrain: false,
        options: { timeLabels: [{ lat: 46, lng: -114, label: "0m" }], ...extra },
      });
      const layer = (id: string) => style.layers.find((l) => l.id === id) as Painted;
      expect(layer(TIME_LABELS_LAYER).layout?.["text-size"]).toBe(20);
      expect(layer(TIME_LABEL_DOTS_LAYER).paint?.["circle-radius"]).toEqual([
        "interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 4.5,
      ]);
    }
  });
});

describe("route colour", () => {
  it("defaults to the theme's overlay route colour and accepts only #rrggbb", () => {
    expect(themeRouteColor(LIGHT)).toBe("#1a56c4");
    expect(themeRouteColor(DARK)).toBe("#33d6ff");
    expect(isHexColor("#1A56c4")).toBe(true);
    expect(isHexColor("#1a56c")).toBe(false);
    expect(isHexColor("1a56c4")).toBe(false);
  });
});
