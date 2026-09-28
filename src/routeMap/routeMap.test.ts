import { describe, expect, it } from "vitest";
import { buildRouteMapStyle, routeBasemapBase } from "./index";
import { BASEMAP_SOURCE, ROUTE_SOURCE, buildStyle } from "./style";

const BASE = "https://basemap.example.com/v4";
const PATH = [
  { lat: 46.87, lng: -113.99 },
  { lat: 46.92, lng: -114.05 },
];

describe("routeMap style builders", () => {
  it("puts the tile and glyph URLs under the configured base URL", () => {
    const style = buildRouteMapStyle({ routeBasemapUrl: BASE }, "light", PATH);
    expect(style.glyphs).toBe(`${BASE}/glyphs/{fontstack}/{range}.pbf`);
    const basemap = style.sources[BASEMAP_SOURCE] as { type: string; url: string };
    expect(basemap.type).toBe("vector");
    expect(basemap.url).toBe(`pmtiles://${BASE}/tiles.pmtiles`);
    expect(style.sources[ROUTE_SOURCE]).toBeDefined();
  });

  it("builds both appearances with the same sources and layer ids", () => {
    const light = buildStyle("light", BASE, PATH);
    const dark = buildStyle("dark", BASE, PATH);
    expect(Object.keys(dark.sources)).toEqual(Object.keys(light.sources));
    expect(dark.layers.map((l) => l.id)).toEqual(light.layers.map((l) => l.id));
    expect(light.layers.length).toBeGreaterThan(3);
  });

  it("reports no base and refuses to build while the variable is unset", () => {
    expect(routeBasemapBase({ routeBasemapUrl: "" })).toBeNull();
    expect(() => buildRouteMapStyle({ routeBasemapUrl: "" }, "dark", PATH)).toThrow(
      "VITE_ROUTE_BASEMAP_URL is not set"
    );
  });

  it("reads the base from the panel config", () => {
    expect(routeBasemapBase({ routeBasemapUrl: BASE })).toBe(BASE);
  });
});
