import { describe, expect, it } from "vitest";
import routePreview from "../../../contracts/schema/sections/route_preview.schema.json";
import {
  MAX_LANDMARKS,
  addLandmark,
  landmarksValue,
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
});
