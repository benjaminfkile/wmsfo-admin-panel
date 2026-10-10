// admin.md 9.1: the style file check, the API's shape rules for both
// renderers, then `validateStyleMin` for MapLibre.

import { describe, expect, it } from "vitest";
import lightStyle from "../../../contracts/fixtures/themes/light.json";
import standard from "../../../contracts/fixtures/themes/standard.json";
import { checkStyle, type StyleCheck } from "./styleCheck";

function reason(c: StyleCheck): string {
  if (c.ok) throw new Error("expected a refusal");
  return c.reason;
}

function withSource(id: string, source: Record<string, unknown>) {
  return { ...lightStyle, sources: { ...lightStyle.sources, [id]: source } };
}

describe("checkStyle", () => {
  it("passes the two seed fixtures with their layer counts", () => {
    const light = checkStyle("maplibre", JSON.stringify(lightStyle));
    expect(light.ok).toBe(true);
    if (light.ok) expect(light.layerCount).toBe(lightStyle.layers.length);
    const google = checkStyle("google", JSON.stringify(standard));
    expect(google.ok).toBe(true);
    if (google.ok) expect(google.layerCount).toBe(standard.length);
  });

  it("refuses a file that is not JSON", () => {
    expect(reason(checkStyle("google", "{ nope"))).toBe("The file is not valid JSON.");
  });

  it("refuses a Google array with a stray key", () => {
    const style = [...standard, { featureType: "road", colour: "#fff" }];
    expect(reason(checkStyle("google", JSON.stringify(style)))).toBe(
      `Rule ${style.length} has the key "colour"; only featureType, elementType, and stylers are allowed.`,
    );
  });

  it("refuses a MapLibre style for the Google renderer", () => {
    expect(reason(checkStyle("google", JSON.stringify(lightStyle)))).toBe(
      "A Google Maps style is a JSON array of style rules.",
    );
  });

  it("strips glyphs, sprite, and the source url and tiles before the rules run", () => {
    const style = {
      ...lightStyle,
      glyphs: "https://basemap.test/glyphs/{fontstack}/{range}.pbf",
      sprite: "https://basemap.test/sprite",
      sources: {
        ...lightStyle.sources,
        basemap: {
          ...lightStyle.sources.basemap,
          url: "pmtiles://https://basemap.test/tiles.pmtiles",
          tiles: ["https://basemap.test/{z}/{x}/{y}.pbf"],
        },
      },
    };
    const c = checkStyle("maplibre", JSON.stringify(style));
    if (!c.ok) throw new Error(c.reason);
    const out = c.style as Record<string, unknown> & { sources: Record<string, object> };
    expect(out).not.toHaveProperty("glyphs");
    expect(out).not.toHaveProperty("sprite");
    expect(out.sources.basemap).not.toHaveProperty("url");
    expect(out.sources.basemap).not.toHaveProperty("tiles");
    expect(out).toEqual(lightStyle);
    expect(c.canonicalBytes).toBe(new TextEncoder().encode(JSON.stringify(lightStyle)).length);
  });

  it("refuses a source other than basemap and terrain", () => {
    const style = withSource("extra", { type: "vector" });
    expect(reason(checkStyle("maplibre", JSON.stringify(style)))).toMatch(
      /^The source "extra" is not allowed/,
    );
  });

  it("refuses a layer on an unknown source", () => {
    const style = {
      ...lightStyle,
      layers: [...lightStyle.layers, { id: "stray", type: "line", source: "roads", "source-layer": "x" }],
    };
    expect(reason(checkStyle("maplibre", JSON.stringify(style)))).toBe(
      'The layer "stray" uses the source "roads"; layers draw from "basemap" or "terrain".',
    );
  });

  it("refuses a string starting with http", () => {
    const style = {
      ...lightStyle,
      layers: [
        ...lightStyle.layers,
        {
          id: "icons",
          type: "symbol",
          source: "basemap",
          "source-layer": "pois",
          layout: { "icon-image": "https://example.test/pin.png" },
        },
      ],
    };
    expect(reason(checkStyle("maplibre", JSON.stringify(style)))).toBe(
      `The string at layers[${lightStyle.layers.length}].layout.icon-image starts with http; the style must not name a URL.`,
    );
  });

  it("refuses a version other than 8", () => {
    expect(reason(checkStyle("maplibre", JSON.stringify({ ...lightStyle, version: 7 })))).toBe(
      "The style's version must be 8.",
    );
  });

  it("refuses an oversize file", () => {
    const rule = { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] };
    const big = Array.from({ length: 1200 }, () => rule);
    expect(reason(checkStyle("google", JSON.stringify(big)))).toMatch(
      /^The style is \d+ KB; the limit is 64 KB\.$/,
    );
    const layers = Array.from({ length: 9000 }, (_, i) => ({
      id: `bg-${i}`,
      type: "background",
      paint: { "background-color": "#ffffff" },
    }));
    expect(reason(checkStyle("maplibre", JSON.stringify({ ...lightStyle, layers })))).toMatch(
      /the limit is 512 KB\.$/,
    );
  });

  it("shows the first problem validateStyleMin finds", () => {
    const style = {
      ...lightStyle,
      layers: [
        { id: "bad", type: "line", source: "basemap", "source-layer": "roads", paint: { "line-color": "nope" } },
      ],
    };
    expect(reason(checkStyle("maplibre", JSON.stringify(style)))).toBe(
      'layers[0].paint.line-color: color expected, "nope" found',
    );
  });
});
