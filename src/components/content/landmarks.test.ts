import { describe, expect, it } from "vitest";
import routePreview from "../../../contracts/schema/sections/route_preview.schema.json";
import {
  MAX_LANDMARK_DESCRIPTION,
  MAX_LANDMARKS,
  addLandmark,
  landmarksValue,
  makeLandmark,
  moveLandmark,
  removeLandmark,
  replaceLandmark,
  toLandmarks,
  type Landmark,
} from "./landmarks";

function make(n: number): Landmark[] {
  return Array.from({ length: n }, (_, i) => ({ name: `L${i}`, lat: i + 0.5, lng: -i - 0.5 }));
}

describe("the landmarks list", () => {
  it("caps at the schema's maxItems", () => {
    expect(MAX_LANDMARKS).toBe(routePreview.properties.landmarks.maxItems);
  });

  it("round-trips a stored list and drops entries of another shape", () => {
    const list = make(3);
    expect(toLandmarks(JSON.parse(JSON.stringify(list)))).toEqual(list);
    expect(toLandmarks([{ name: "A", lat: 1 }, null, { name: "B", lat: 1, lng: 2 }])).toEqual([
      { name: "B", lat: 1, lng: 2 },
    ]);
    expect(toLandmarks(undefined)).toEqual([]);
  });

  it("adds under the cap and refuses at it", () => {
    const entry = { name: "New", lat: 1, lng: 2 };
    expect(addLandmark(make(49), entry)).toHaveLength(50);
    const full = make(50);
    const after = addLandmark(full, entry);
    expect(after).toEqual(full);
    expect(toLandmarks(landmarksValue(after))).toHaveLength(50);
  });

  it("edits, reorders, and deletes", () => {
    const list = make(3);
    expect(replaceLandmark(list, 1, { name: "X", lat: 5, lng: 6 })[1]).toEqual({
      name: "X",
      lat: 5,
      lng: 6,
    });
    expect(moveLandmark(list, 0, 2).map((l) => l.name)).toEqual(["L1", "L2", "L0"]);
    expect(moveLandmark(list, 0, 3)).toEqual(list);
    expect(removeLandmark(list, 1).map((l) => l.name)).toEqual(["L0", "L2"]);
  });

  it("writes an empty list as the key absent", () => {
    expect(landmarksValue([])).toBeUndefined();
  });

  it("round-trips an icon and a description", () => {
    const stored = [
      {
        name: "Santa at the mall",
        lat: 1,
        lng: 2,
        icon: { source: "library", id: "cookie", display: { invert: "dark" } },
        description: "Hot cocoa by the fountain.",
      },
      { name: "Media", lat: 3, lng: 4, icon: { source: "media", id: "m1" } },
    ];
    const list = toLandmarks(JSON.parse(JSON.stringify(stored)));
    expect(list).toEqual(stored);
    expect(landmarksValue(list)).toEqual(stored);
  });

  it("leaves an icon or description of another shape off the entry", () => {
    expect(
      toLandmarks([
        { name: "A", lat: 1, lng: 2, icon: { source: "other", id: "x" }, description: "" },
        { name: "B", lat: 1, lng: 2, icon: null, description: 5 },
      ])
    ).toEqual([
      { name: "A", lat: 1, lng: 2 },
      { name: "B", lat: 1, lng: 2 },
    ]);
  });

  it("keeps entries without an icon or description unchanged", () => {
    const list = make(3);
    const out = landmarksValue(toLandmarks(JSON.parse(JSON.stringify(list))));
    expect(out).toEqual(list);
    for (const entry of out ?? []) {
      expect(Object.keys(entry).sort()).toEqual(["lat", "lng", "name"]);
    }
  });

  it("builds an entry with the optional keys only when set", () => {
    const base = { name: "A", lat: 1, lng: 2 };
    expect(makeLandmark(base)).toEqual(base);
    expect(Object.keys(makeLandmark(base, null, "   "))).toEqual(["name", "lat", "lng"]);
    expect(
      makeLandmark(base, { source: "library", id: "cookie" }, "  Cocoa  ")
    ).toEqual({ ...base, icon: { source: "library", id: "cookie" }, description: "Cocoa" });
  });

  it("caps the description at the schema's maxLength", () => {
    expect(MAX_LANDMARK_DESCRIPTION).toBe(
      routePreview.properties.landmarks.items.properties.description.maxLength
    );
    const long = "x".repeat(MAX_LANDMARK_DESCRIPTION + 20);
    expect(makeLandmark({ name: "A", lat: 1, lng: 2 }, null, long).description).toHaveLength(
      MAX_LANDMARK_DESCRIPTION
    );
  });
});
