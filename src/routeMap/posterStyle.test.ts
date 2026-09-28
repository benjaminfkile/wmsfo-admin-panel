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
import { ROUTE_PALETTES } from "./flavors";
import { ARROWS_LAYER, ROUTE_LAYER, TIME_LABELS_LAYER, TIME_LABELS_SOURCE } from "./style";

const BASE = "https://basemap.example.com/v4";

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
  it("formats elapsed time as +h:mm", () => {
    expect(formatElapsed(0)).toBe("+0:00");
    expect(formatElapsed(47)).toBe("+0:47");
    expect(formatElapsed(65)).toBe("+1:05");
  });

  it("formats the wall clock in the event's schedule zone", () => {
    // 2026-12-24T01:00Z is 18:00 in Denver (MST) and 19:00 in Chicago (CST).
    expect(formatWallClock("2026-12-24T01:00:00Z", 15, "America/Denver")).toBe("18:15");
    expect(formatWallClock("2026-12-24T01:00:00Z", 15, "America/Chicago")).toBe("19:15");
  });

  it("follows the zone across a daylight saving change", () => {
    // Denver falls back at 02:00 MDT on 2026-11-01 (08:00Z).
    expect(formatWallClock("2026-11-01T07:30:00Z", 0, "America/Denver")).toBe("01:30");
    expect(formatWallClock("2026-11-01T07:30:00Z", 45, "America/Denver")).toBe("01:15");
  });

  it("labels the entries as wall clock or elapsed", () => {
    const settings = {
      interval: 30 as const,
      scheduledAt: "2026-12-24T01:00:00Z",
      zone: "America/Denver",
    };
    expect(posterTimeLabels(TIMELINE, { ...settings, format: "wall" })).toEqual([
      { lat: 46, lng: -114, label: "18:00" },
      { lat: 46.3, lng: -114.3, label: "18:30" },
      { lat: 46.47, lng: -114.47, label: "18:47" },
    ]);
    expect(
      posterTimeLabels(TIMELINE, { ...settings, format: "elapsed" }).map((l) => l.label),
    ).toEqual(["+0:00", "+0:30", "+0:47"]);
  });

  it("falls back to elapsed labels without a scheduled time", () => {
    expect(
      posterTimeLabels(TIMELINE, {
        interval: 30,
        format: "wall",
        scheduledAt: null,
        zone: "America/Denver",
      }).map((l) => l.label),
    ).toEqual(["+0:00", "+0:30", "+0:47"]);
  });
});

describe("buildPosterStyle", () => {
  const routeMap = {
    path: TIMELINE.map(({ lat, lng }) => ({ lat, lng })),
    timeline: TIMELINE,
    durationMinutes: 47,
  };

  it("draws the colour, the arrows, and the time labels", () => {
    const style = buildPosterStyle(
      { routeBasemapUrl: BASE },
      {
        theme: "light",
        routeMap,
        terrain: false,
        options: {
          routeColor: "#ff0000",
          arrows: true,
          timeLabels: [{ lat: 46, lng: -114, label: "+0:00" }],
        },
      },
    );
    const ids = style.layers.map((l) => l.id);
    const line = style.layers.find((l) => l.id === ROUTE_LAYER) as { paint: Record<string, unknown> };
    expect(line.paint["line-color"]).toBe("#ff0000");
    expect(ids).toContain(ARROWS_LAYER);
    expect(ids).toContain(TIME_LABELS_LAYER);
    expect(style.sources[TIME_LABELS_SOURCE]).toBeDefined();
  });

  it("leaves the arrows and labels out when they are off", () => {
    const style = buildPosterStyle(
      { routeBasemapUrl: BASE },
      { theme: "dark", routeMap, terrain: false, options: { arrows: false, timeLabels: [] } },
    );
    const ids = style.layers.map((l) => l.id);
    expect(ids).not.toContain(ARROWS_LAYER);
    expect(ids).not.toContain(TIME_LABELS_LAYER);
  });
});

describe("route colour", () => {
  it("defaults to the theme's route colour and accepts only #rrggbb", () => {
    expect(themeRouteColor("light")).toBe(ROUTE_PALETTES.light.routeColor);
    expect(themeRouteColor("dark")).toBe(ROUTE_PALETTES.dark.routeColor);
    expect(isHexColor("#1A56c4")).toBe(true);
    expect(isHexColor("#1a56c")).toBe(false);
    expect(isHexColor("1a56c4")).toBe(false);
  });
});
