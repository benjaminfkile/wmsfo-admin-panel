import { describe, expect, it } from "vitest";
import {
  EXPORT_TERRAIN_MAX_ZOOM,
  MISSOULA_VALLEY_BBOX,
  TERRAIN_MAX_ZOOM_RANGE,
  bboxContains,
  bboxValid,
  clampZoom,
  exportDocument,
  exportFileName,
  fitZoom,
  minZoomCaption,
  siteDefaultBbox,
  toBbox,
  validateBbox,
} from "./bbox";

const BOX = { west: -114.3, south: 46.75, east: -113.8, north: 47.05 };

describe("bbox rules", () => {
  it("accepts a box inside every rule", () => {
    expect(validateBbox(BOX)).toEqual({});
    expect(bboxValid(MISSOULA_VALLEY_BBOX)).toBe(true);
  });

  it("needs west under east and south under north", () => {
    expect(validateBbox({ ...BOX, west: -113.5 })).toEqual({ west: "West must be less than east" });
    expect(validateBbox({ ...BOX, west: BOX.east })).toEqual({ west: "West must be less than east" });
    expect(validateBbox({ ...BOX, south: 47.1 })).toEqual({ south: "South must be less than north" });
  });

  it("keeps each side between 0.05 and 20 degrees", () => {
    const msg = "Each side must be between 0.05 and 20 degrees";
    expect(validateBbox({ ...BOX, east: BOX.west + 0.04 })).toEqual({ east: msg });
    expect(validateBbox({ ...BOX, north: BOX.south + 0.04 })).toEqual({ north: msg });
    expect(validateBbox({ ...BOX, west: BOX.east - 20.5 })).toEqual({ east: msg });
    expect(validateBbox({ ...BOX, north: BOX.south + 21 })).toEqual({ north: msg });
    expect(validateBbox({ west: 0, south: 0, east: 0.05, north: 20 })).toEqual({});
  });

  it("holds longitudes to -180 to 180 and latitudes to -90 to 90", () => {
    expect(validateBbox({ ...BOX, west: -181 })).toEqual({ west: "West must be between -180 and 180" });
    expect(validateBbox({ west: 170, south: 0, east: 181, north: 1 })).toEqual({
      east: "East must be between -180 and 180",
    });
    expect(validateBbox({ west: 0, south: -91, east: 1, north: -89 })).toEqual({
      south: "South must be between -90 and 90",
    });
    expect(validateBbox({ west: 0, south: 89, east: 1, north: 91 })).toEqual({
      north: "North must be between -90 and 90",
    });
    expect(validateBbox({ ...BOX, west: Number.NaN })).toEqual({ west: "Enter a number" });
  });
});

describe("fitZoom", () => {
  it("fills a phone and a desktop with the Missoula valley box", () => {
    expect(fitZoom(MISSOULA_VALLEY_BBOX, 390, 844)).toBeCloseTo(8.818, 3);
    expect(fitZoom(MISSOULA_VALLEY_BBOX, 1280, 800)).toBeCloseTo(9.278, 3);
    expect(minZoomCaption(MISSOULA_VALLEY_BBOX)).toBe("Minimum zoom: 8.8 on a phone, 9.3 on a desktop");
  });

  it("zooms in one level for a box half as wide and half as tall", () => {
    const half = { west: -114, south: 46.8, east: -113.5, north: 47 };
    const quarter = { west: -114, south: 46.8, east: -113.75, north: 46.9 };
    expect(fitZoom(quarter, 1280, 800) - fitZoom(half, 1280, 800)).toBeCloseTo(1, 1);
  });
});

describe("the export document", () => {
  it("carries the name, the box, and the zoom defaults 15 and 13", () => {
    expect(exportDocument("Santa Flyover 2026", BOX)).toEqual({
      name: "Santa Flyover 2026",
      bbox: BOX,
      maxZoom: 15,
      terrainMaxZoom: 13,
    });
    expect(exportDocument("Site default", BOX, 12, 10)).toMatchObject({ maxZoom: 12, terrainMaxZoom: 10 });
  });

  it("names the file after the name", () => {
    expect(exportFileName("Santa Flyover 2026")).toBe("Santa Flyover 2026.json");
    expect(exportFileName("Site default")).toBe("Site default.json");
    expect(exportFileName("a/b")).toBe("a b.json");
    expect(exportFileName("")).toBe("area.json");
  });

  it("clamps the zoom fields to their ranges", () => {
    expect(clampZoom("20", { min: 8, max: 15 }, 15)).toBe(15);
    expect(clampZoom("3", { min: 8, max: 13 }, 13)).toBe(8);
    expect(clampZoom("x", { min: 8, max: 13 }, 13)).toBe(13);
  });

  it("takes a terrain max zoom of 8 to 15 and starts at 13", () => {
    expect(TERRAIN_MAX_ZOOM_RANGE).toEqual({ min: 8, max: 15 });
    expect(EXPORT_TERRAIN_MAX_ZOOM).toBe(13);
    const fifteen = clampZoom("15", TERRAIN_MAX_ZOOM_RANGE, EXPORT_TERRAIN_MAX_ZOOM);
    expect(fifteen).toBe(15);
    expect(exportDocument("Site default", BOX, 15, fifteen)).toMatchObject({ terrainMaxZoom: 15 });
    expect(clampZoom("16", TERRAIN_MAX_ZOOM_RANGE, EXPORT_TERRAIN_MAX_ZOOM)).toBe(15);
    expect(clampZoom("", TERRAIN_MAX_ZOOM_RANGE, EXPORT_TERRAIN_MAX_ZOOM)).toBe(13);
  });
});

describe("box helpers", () => {
  it("reads a box from an API body and the site default", () => {
    expect(toBbox({ west: "-114.3", south: 46.75, east: -113.8, north: 47.05 })).toEqual(BOX);
    expect(toBbox({ west: -114.3 })).toBeNull();
    expect(siteDefaultBbox({ tracker: { defaultBbox: BOX } })).toEqual(BOX);
    expect(siteDefaultBbox({ siteName: "x" })).toEqual(MISSOULA_VALLEY_BBOX);
  });

  it("tells whether one box contains another", () => {
    expect(bboxContains(MISSOULA_VALLEY_BBOX, BOX)).toBe(true);
    expect(bboxContains(BOX, MISSOULA_VALLEY_BBOX)).toBe(false);
  });
});
