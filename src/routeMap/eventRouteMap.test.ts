import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import type { TrackerMap, TrackerTheme } from "../api/types";
import themeSeed from "../../contracts/fixtures/themes/seed.json";
import routeLightStyle from "../../contracts/fixtures/themes/route-light.json";
import {
  NO_MAP_HINT,
  NO_THEME_HINT,
  eventRouteMapOptions,
  eventRouteMapSource,
  eventRouteMapStyle,
  readControl,
  resolveRouteMapConfig,
  routeMapConfigBody,
  routeMapConfigSummary,
  siteTimeLabels,
  toRouteMapConfig,
  withControl,
  withGroup,
} from "./eventRouteMap";
import { ROUTE_LAYER, TIME_LABELS_LAYER } from "./routeLayers";
import type { RouteMapData } from "./poster";

const routeMap: RouteMapData = {
  path: [
    { lat: 1, lng: 1 },
    { lat: 2, lng: 2 },
  ],
  timeline: [
    { minutes: 0, lat: 1, lng: 1 },
    { minutes: 15, lat: 1.2, lng: 1.2 },
    { minutes: 30, lat: 1.5, lng: 1.5 },
    { minutes: 45, lat: 1.8, lng: 1.8 },
    { minutes: 60, lat: 2, lng: 2 },
  ],
  durationMinutes: 60,
};


describe("toRouteMapConfig", () => {
  it("reads null and {} as no group", () => {
    expect(toRouteMapConfig(null)).toEqual({});
    expect(toRouteMapConfig({})).toEqual({});
    expect(toRouteMapConfig({ display: null, controls: null, landmarks: null, pois: null })).toEqual(
      {}
    );
  });

  it("keeps contract values and drops the rest, landmarks and pois included", () => {
    expect(
      toRouteMapConfig({
        display: {
          timeLabelIntervalMinutes: 7,
          arrows: false,
          arrowSize: "huge",
          routeWidth: "thin",
          labelSize: "tiny",
        },
        controls: { fullscreen: "no", terrain: false },
        landmarks: [{ name: "A", lat: 1, lng: 2 }],
        pois: { kinds: ["park", 3] },
      })
    ).toEqual({
      display: { arrows: false, routeWidth: "thin" },
      controls: { terrain: false },
    });
  });
});

describe("withGroup and routeMapConfigBody", () => {
  it("removes a group set to nothing and saves an empty config as null", () => {
    let c = withGroup({}, "controls", { terrain: false });
    c = withGroup(c, "display", { arrows: true });
    expect(routeMapConfigBody(c)).toEqual({
      controls: { terrain: false },
      display: { arrows: true },
    });
    c = withGroup(c, "controls", {});
    c = withGroup(c, "display", undefined);
    expect(c).toEqual({});
    expect(routeMapConfigBody(c)).toBeNull();
  });
});

describe("the controls", () => {
  it("read on unless stored as false and write the flipped value", () => {
    expect(readControl(undefined, "terrain")).toBe(true);
    expect(readControl({ terrain: true }, "terrain")).toBe(true);
    expect(readControl({ terrain: false }, "terrain")).toBe(false);
    expect(withControl(undefined, "fullscreen", true)).toEqual({ fullscreen: true });
    expect(withControl({ terrain: false }, "fullscreen", false)).toEqual({
      terrain: false,
      fullscreen: false,
    });
  });
});

describe("resolveRouteMapConfig", () => {
  it("resolves the site's defaults", () => {
    expect(resolveRouteMapConfig({})).toEqual({
      timeLabelIntervalMinutes: 15,
      arrows: true,
      arrowScale: 1,
      routeWidthScale: 1,
      labelScale: 1,
      controls: { fullscreen: true, terrain: true },
    });
  });

  it("maps the named sizes to their scales", () => {
    const r = resolveRouteMapConfig({ display: { arrowSize: "xlarge", routeWidth: "thin" } });
    expect(r.arrowScale).toBe(2);
    expect(r.routeWidthScale).toBe(0.75);
    expect(resolveRouteMapConfig({ display: { labelSize: "small" } }).labelScale).toBe(0.8);
    expect(resolveRouteMapConfig({ display: { labelSize: "medium" } }).labelScale).toBe(1);
    expect(resolveRouteMapConfig({ display: { labelSize: "large" } }).labelScale).toBe(1.3);
  });
});

describe("siteTimeLabels", () => {
  it("labels the interior multiples as elapsed time and none at 0", () => {
    expect(siteTimeLabels(routeMap.timeline, 15).map((l) => l.label)).toEqual(["15m", "30m", "45m"]);
    expect(siteTimeLabels(routeMap.timeline, 30).map((l) => l.label)).toEqual(["30m"]);
    expect(siteTimeLabels(routeMap.timeline, 0)).toEqual([]);
  });
});

const THEMES = themeSeed.map((t, i) => ({ ...t, id: i + 1 })) as TrackerTheme[];
const LIGHT = THEMES.find((t) => t.key === "route-light")!;
const BODY = routeLightStyle as StyleSpecification;
const MAPS: TrackerMap[] = [
  {
    id: 1,
    name: "Missoula valley",
    tilesUrl: "https://cdn.example/basemap/tiles.pmtiles",
    terrainUrl: "https://cdn.example/basemap/terrain.pmtiles",
  },
  { id: 2, name: "Bitterroot", tilesUrl: "https://cdn.example/maps/2/tiles.pmtiles", terrainUrl: null },
];

describe("eventRouteMapOptions and eventRouteMapStyle", () => {
  it("passes the arrows and scales of the config", () => {
    const options = eventRouteMapOptions(routeMap, {
      display: { arrows: false, arrowSize: "large", routeWidth: "thick", timeLabelIntervalMinutes: 30 },
    });
    expect(options.arrows).toBeUndefined();
    expect(options.arrowScale).toBe(1.5);
    expect(options.routeWidthScale).toBe(1.5);
    expect(options.labelScale).toBe(1);
    expect(eventRouteMapOptions(routeMap, { display: { labelSize: "large" } }).labelScale).toBe(1.3);
    expect(options.timeLabels?.map((l) => l.label)).toEqual(["30m"]);
    const defaults = eventRouteMapOptions(routeMap, {});
    expect(defaults.arrows).toBe(true);
    expect(defaults.labelScale).toBe(1);
    expect(defaults.labelCurve).toBeUndefined();
  });

  it("draws the theme body over the event's map with the route in the theme's colours", () => {
    const style = eventRouteMapStyle({
      theme: { overlay: LIGHT.overlay, body: BODY },
      map: MAPS[1]!,
      routeMap,
      routeMapConfig: {},
      terrain: false,
    });
    expect(style.sources.basemap).toMatchObject({ url: `pmtiles://${MAPS[1]!.tilesUrl}` });
    const ids = style.layers.map((l) => l.id);
    expect(ids.indexOf("earth")).toBeLessThan(ids.indexOf(ROUTE_LAYER));
    expect(ids).toContain(TIME_LABELS_LAYER);
    const line = style.layers.find((l) => l.id === ROUTE_LAYER) as { paint: Record<string, unknown> };
    expect(line.paint["line-color"]).toBe(LIGHT.overlay?.routeColor);
  });

  it("keeps the places layers to the given kinds and hides them without any", () => {
    const pois = (poiKinds?: readonly string[]) =>
      eventRouteMapStyle({
        theme: { overlay: LIGHT.overlay, body: BODY },
        map: MAPS[0]!,
        routeMap,
        routeMapConfig: {},
        terrain: false,
        poiKinds,
      }).layers.find((l) => l.id === "pois") as {
        filter?: unknown;
        layout?: Record<string, unknown>;
      };
    expect(JSON.stringify(pois(["park"]).filter)).toContain('"park"');
    expect(pois(undefined).layout?.visibility).toBe("none");
    expect(pois([]).layout?.visibility).toBe("none");
  });

  it("draws the hillshade only while the config keeps the terrain toggle and the map has terrain", () => {
    const style = (terrain: boolean, kept: boolean, map = MAPS[0]!) =>
      eventRouteMapStyle({
        theme: { overlay: LIGHT.overlay, body: BODY },
        map,
        routeMap,
        routeMapConfig: kept ? {} : { controls: { terrain: false } },
        terrain,
      });
    const shaded = (s: StyleSpecification) =>
      s.sources.terrain !== undefined &&
      s.layers.some((l) => (l as { source?: string }).source === "terrain");
    expect(shaded(style(true, true))).toBe(true);
    expect(style(true, true).sources.terrain).toMatchObject({ url: `pmtiles://${MAPS[0]!.terrainUrl}` });
    expect(shaded(style(true, false))).toBe(false);
    expect(shaded(style(false, true))).toBe(false);
    expect(shaded(style(true, true, MAPS[1]!))).toBe(false);
  });
});

describe("eventRouteMapSource", () => {
  const event = { trackerMapId: 1, trackerThemeIds: [1, 2, 3] };

  it("picks the event's map and its MapLibre theme carrying the appearance's default", () => {
    const light = eventRouteMapSource(event, MAPS, THEMES, "light");
    expect(light.hint).toBeNull();
    expect(light.map?.id).toBe(1);
    expect(light.theme?.key).toBe("route-light");
    expect(eventRouteMapSource(event, MAPS, THEMES, "dark").theme?.key).toBe("route-dark");
    expect(eventRouteMapSource({ ...event, trackerMapId: 2 }, MAPS, THEMES, "dark").map?.id).toBe(2);
  });

  it("falls back to the first enabled MapLibre theme without the flag", () => {
    const only = { ...event, trackerThemeIds: [2, 3] };
    expect(eventRouteMapSource(only, MAPS, THEMES, "light").theme?.key).toBe("route-dark");
  });

  it("gives the hint without a map or without an enabled MapLibre theme", () => {
    for (const trackerMapId of [null, undefined, 42]) {
      expect(eventRouteMapSource({ ...event, trackerMapId }, MAPS, THEMES, "light")).toEqual({
        theme: null,
        map: null,
        hint: NO_MAP_HINT,
      });
    }
    expect(eventRouteMapSource({ ...event, trackerThemeIds: [3, 7] }, MAPS, THEMES, "light").hint).toBe(
      NO_THEME_HINT,
    );
    expect(eventRouteMapSource({ ...event, trackerThemeIds: [] }, MAPS, THEMES, "dark").hint).toBe(
      NO_THEME_HINT,
    );
  });
});

describe("routeMapConfigSummary", () => {
  it("lists only the settings off their default", () => {
    expect(routeMapConfigSummary({})).toEqual({ changed: [] });
    expect(
      routeMapConfigSummary({
        display: { timeLabelIntervalMinutes: 15, arrowSize: "small", labelSize: "large" },
        controls: { fullscreen: true, terrain: false },
      })
    ).toEqual({
      changed: [
        { label: "Arrow size", value: "Small" },
        { label: "Label size", value: "Large" },
        { label: "Terrain toggle", value: "Off" },
      ],
    });
  });
});
