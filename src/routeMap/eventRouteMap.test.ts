import { describe, expect, it } from "vitest";
import {
  eventRouteMapOptions,
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
import { HILLSHADE_LAYER, TERRAIN_SOURCE } from "./style";
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

const config = { routeBasemapUrl: "https://basemap.test" };

describe("toRouteMapConfig", () => {
  it("reads null and {} as no group", () => {
    expect(toRouteMapConfig(null)).toEqual({});
    expect(toRouteMapConfig({})).toEqual({});
    expect(toRouteMapConfig({ display: null, controls: null, landmarks: null, pois: null })).toEqual(
      {}
    );
  });

  it("keeps contract values and drops the rest", () => {
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
        landmarks: [{ name: "A", lat: 1, lng: 2 }, { name: "B" }],
        pois: { kinds: ["park", 3] },
      })
    ).toEqual({
      display: { arrows: false, routeWidth: "thin" },
      controls: { terrain: false },
      landmarks: [{ name: "A", lat: 1, lng: 2 }],
      pois: { kinds: ["park"] },
    });
  });
});

describe("withGroup and routeMapConfigBody", () => {
  it("removes a group set to nothing and saves an empty config as null", () => {
    let c = withGroup({}, "landmarks", [{ name: "A", lat: 1, lng: 2 }]);
    c = withGroup(c, "display", { arrows: true });
    expect(routeMapConfigBody(c)).toEqual({
      landmarks: [{ name: "A", lat: 1, lng: 2 }],
      display: { arrows: true },
    });
    c = withGroup(c, "landmarks", []);
    c = withGroup(c, "display", undefined);
    expect(c).toEqual({});
    expect(routeMapConfigBody(c)).toBeNull();
  });

  it("keeps a Custom points of interest choice with nothing checked", () => {
    expect(routeMapConfigBody(withGroup({}, "pois", { kinds: [] }))).toEqual({ pois: { kinds: [] } });
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
      landmarks: undefined,
      poiKinds: undefined,
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

describe("eventRouteMapOptions and eventRouteMapStyle", () => {
  it("passes the landmarks, POI kinds, arrows, and scales", () => {
    const options = eventRouteMapOptions(routeMap, {
      display: { arrows: false, arrowSize: "large", routeWidth: "thick", timeLabelIntervalMinutes: 30 },
      landmarks: [{ name: "Depot", lat: 1.1, lng: 1.1 }],
      pois: { kinds: ["park"] },
    });
    expect(options.arrows).toBeUndefined();
    expect(options.arrowScale).toBe(1.5);
    expect(options.routeWidthScale).toBe(1.5);
    expect(options.labelScale).toBe(1);
    expect(eventRouteMapOptions(routeMap, { display: { labelSize: "large" } }).labelScale).toBe(1.3);
    expect(options.timeLabels?.map((l) => l.label)).toEqual(["30m"]);
    expect(options.landmarks).toEqual([{ lat: 1.1, lng: 1.1, label: "Depot" }]);
    expect(options.poiKinds).toEqual(["park"]);
    const defaults = eventRouteMapOptions(routeMap, {});
    expect(defaults.arrows).toBe(true);
    expect(defaults.landmarks).toBeUndefined();
    expect(defaults.poiKinds).toBeUndefined();
    expect(defaults.labelScale).toBe(1);
    expect(defaults.labelCurve).toBeUndefined();
  });

  it("draws the hillshade only while the config keeps the terrain toggle", () => {
    const layers = (terrain: boolean, kept: boolean) =>
      eventRouteMapStyle(config, {
        appearance: "light",
        routeMap,
        routeMapConfig: kept ? {} : { controls: { terrain: false } },
        terrain,
      });
    expect(layers(true, true).sources[TERRAIN_SOURCE]).toBeDefined();
    expect(layers(true, true).layers.some((l) => l.id === HILLSHADE_LAYER)).toBe(true);
    expect(layers(true, false).sources[TERRAIN_SOURCE]).toBeUndefined();
    expect(layers(false, true).sources[TERRAIN_SOURCE]).toBeUndefined();
  });
});

describe("routeMapConfigSummary", () => {
  it("counts landmarks and lists only the settings off their default", () => {
    expect(routeMapConfigSummary({})).toEqual({ landmarks: 0, changed: [] });
    expect(
      routeMapConfigSummary({
        display: { timeLabelIntervalMinutes: 15, arrowSize: "small", labelSize: "large" },
        controls: { fullscreen: true, terrain: false },
        landmarks: [{ name: "A", lat: 1, lng: 2 }],
        pois: { kinds: [] },
      })
    ).toEqual({
      landmarks: 1,
      changed: [
        { label: "Arrow size", value: "Small" },
        { label: "Label size", value: "Large" },
        { label: "Terrain toggle", value: "Off" },
        { label: "Points of interest", value: "Custom" },
      ],
    });
  });
});
