import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import routeLight from "../../contracts/fixtures/themes/route-light.json";
import routeDark from "../../contracts/fixtures/themes/route-dark.json";
import { applyMap, isPlacesLayer } from "./themeStyle";
import { applyDevBasemap, forMaputnik } from "./index";
import { testConfig } from "../test/renderWithProviders";

const MAP = {
  tilesUrl: "https://cdn.example/basemap/tiles.pmtiles",
  terrainUrl: "https://cdn.example/basemap/terrain.pmtiles",
};
const NO_TERRAIN = { tilesUrl: "https://cdn.example/maps/2/tiles.pmtiles", terrainUrl: null };

const STYLE = {
  version: 8,
  glyphs: "https://cdn.example/glyphs/{fontstack}/{range}.pbf",
  sprite: "https://cdn.example/themes/sprites/abc/sprite",
  sources: {
    basemap: { type: "vector" },
    terrain: { type: "raster-dem", encoding: "terrarium" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#fff" } },
    { id: "hillshade", type: "hillshade", source: "terrain" },
    { id: "roads", type: "line", source: "basemap", "source-layer": "roads" },
    {
      id: "pois",
      type: "symbol",
      source: "basemap",
      "source-layer": "pois",
      filter: [">=", ["zoom"], 12],
      layout: { "text-field": ["get", "name"] },
      metadata: { "wmsfo:places": true },
    },
  ],
} as unknown as StyleSpecification;

function layer(style: StyleSpecification, id: string) {
  return style.layers.find((l) => l.id === id) as Record<string, unknown> | undefined;
}

describe("applyMap", () => {
  it("points basemap and terrain at the map row's pmtiles URLs", () => {
    const out = applyMap(STYLE, MAP, { terrain: true });
    expect(out.sources.basemap).toEqual({ type: "vector", url: `pmtiles://${MAP.tilesUrl}` });
    expect(out.sources.terrain).toEqual({
      type: "raster-dem",
      encoding: "terrarium",
      url: `pmtiles://${MAP.terrainUrl}`,
    });
    expect(layer(out, "hillshade")).toBeDefined();
    // The input is left as it was.
    expect(STYLE.sources.basemap).toEqual({ type: "vector" });
  });

  it("drops the terrain layers for a map without terrain and when terrain is off", () => {
    for (const out of [
      applyMap(STYLE, NO_TERRAIN, { terrain: true }),
      applyMap(STYLE, MAP, { terrain: false }),
    ]) {
      expect(layer(out, "hillshade")).toBeUndefined();
      expect(out.sources.terrain).toBeUndefined();
      expect(out.layers.map((l) => l.id)).toEqual(["bg", "roads", "pois"]);
    }
  });

  it("filters the places layers to the given kinds and hides them for an empty list", () => {
    const kept = applyMap(STYLE, MAP, { terrain: true, poiKinds: ["park", "school"] });
    expect(layer(kept, "pois")?.filter).toEqual([
      "all",
      [">=", ["zoom"], 12],
      ["in", ["get", "kind"], ["literal", ["park", "school"]]],
    ]);
    expect(layer(kept, "roads")).toEqual(layer(STYLE, "roads"));

    const hidden = applyMap(STYLE, MAP, { terrain: true, poiKinds: [] });
    expect(layer(hidden, "pois")?.layout).toEqual({
      "text-field": ["get", "name"],
      visibility: "none",
    });

    const asIs = applyMap(STYLE, MAP, { terrain: true });
    expect(layer(asIs, "pois")).toEqual(layer(STYLE, "pois"));
  });

  it("leaves glyphs and sprite alone", () => {
    const out = applyMap(STYLE, NO_TERRAIN, { terrain: false, poiKinds: [] });
    expect(out.glyphs).toBe(STYLE.glyphs);
    expect(out.sprite).toBe(STYLE.sprite);
  });
});

describe("applyDevBasemap", () => {
  it("points both sources under the configured base", () => {
    const out = applyDevBasemap(STYLE, { routeBasemapUrl: "https://basemap.test" });
    expect(out.sources.basemap).toMatchObject({ url: "pmtiles://https://basemap.test/tiles.pmtiles" });
    expect(out.sources.terrain).toMatchObject({ url: "pmtiles://https://basemap.test/terrain.pmtiles" });
    expect(out.layers).toEqual(STYLE.layers);
    expect(out.glyphs).toBe(STYLE.glyphs);
  });

  it("refuses while the variable is unset", () => {
    expect(() => applyDevBasemap(STYLE, { routeBasemapUrl: "" })).toThrow(/VITE_ROUTE_BASEMAP_URL/);
  });
});

describe("forMaputnik", () => {
  const base = testConfig.routeBasemapUrl;
  const seed = routeLight as unknown as StyleSpecification;

  it("gives the seed the glyph template and the two pmtiles URLs", () => {
    const out = forMaputnik(seed, testConfig);
    expect(out.glyphs).toBe(`${base}/glyphs/{fontstack}/{range}.pbf`);
    expect(out.sources.basemap).toEqual({
      ...seed.sources.basemap,
      url: `pmtiles://${base}/tiles.pmtiles`,
    });
    expect(out.sources.terrain).toEqual({
      ...seed.sources.terrain,
      url: `pmtiles://${base}/terrain.pmtiles`,
    });
    expect(out.layers).toEqual(seed.layers);
  });

  it("keeps the glyphs a body already names", () => {
    expect(forMaputnik(STYLE, testConfig).glyphs).toBe(STYLE.glyphs);
  });

  it("returns the body unchanged without a basemap base", () => {
    expect(forMaputnik(seed, { routeBasemapUrl: "" })).toBe(seed);
  });
});

describe("the two seed fixtures", () => {
  for (const [name, seed] of [
    ["route-light", routeLight],
    ["route-dark", routeDark],
  ] as const) {
    it(`${name} passes through both unchanged apart from its sources`, () => {
      const style = seed as unknown as StyleSpecification;
      expect(style.layers.some(isPlacesLayer)).toBe(true);
      const outs = [
        applyMap(style, MAP, { terrain: true }),
        applyDevBasemap(style, { routeBasemapUrl: "https://basemap.test" }),
      ];
      for (const out of outs) {
        const { sources: outSources, ...outRest } = out;
        const { sources: seedSources, ...seedRest } = style;
        expect(outRest).toEqual(seedRest);
        expect(Object.keys(outSources)).toEqual(Object.keys(seedSources));
        for (const [id, src] of Object.entries(outSources)) {
          const { url, ...rest } = src as { url?: string };
          expect(url).toMatch(/^pmtiles:\/\/.+\.pmtiles$/);
          expect(rest).toEqual(seedSources[id]);
        }
      }
    });
  }
});
