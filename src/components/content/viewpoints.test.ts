import { describe, expect, it } from "vitest";
import primitives from "../../../contracts/schema/primitives.schema.json";
import siteSettings from "../../../contracts/schema/site-settings.schema.json";

const landmarksSchema = siteSettings.properties.landmarks;
const landmarkSchema = primitives.$defs.Landmark;
import {
  MAX_VIEWPOINT_DESCRIPTION,
  MAX_VIEWPOINTS,
  addViewpoint,
  viewpointsValue,
  makeViewpoint,
  moveViewpoint,
  removeViewpoint,
  replaceViewpoint,
  toViewpoints,
  type Viewpoint,
} from "./viewpoints";

function make(n: number): Viewpoint[] {
  return Array.from({ length: n }, (_, i) => ({ name: `L${i}`, lat: i + 0.5, lng: -i - 0.5 }));
}

describe("the viewpoints list", () => {
  it("caps at the schema's maxItems", () => {
    expect(MAX_VIEWPOINTS).toBe(landmarksSchema.maxItems);
  });

  it("round-trips a stored list and drops entries of another shape", () => {
    const list = make(3);
    expect(toViewpoints(JSON.parse(JSON.stringify(list)))).toEqual(list);
    expect(toViewpoints([{ name: "A", lat: 1 }, null, { name: "B", lat: 1, lng: 2 }])).toEqual([
      { name: "B", lat: 1, lng: 2 },
    ]);
    expect(toViewpoints(undefined)).toEqual([]);
  });

  it("adds under the cap and refuses at it", () => {
    const entry = { name: "New", lat: 1, lng: 2 };
    expect(addViewpoint(make(49), entry)).toHaveLength(50);
    const full = make(50);
    const after = addViewpoint(full, entry);
    expect(after).toEqual(full);
    expect(toViewpoints(viewpointsValue(after))).toHaveLength(50);
  });

  it("edits, reorders, and deletes", () => {
    const list = make(3);
    expect(replaceViewpoint(list, 1, { name: "X", lat: 5, lng: 6 })[1]).toEqual({
      name: "X",
      lat: 5,
      lng: 6,
    });
    expect(moveViewpoint(list, 0, 2).map((l) => l.name)).toEqual(["L1", "L2", "L0"]);
    expect(moveViewpoint(list, 0, 3)).toEqual(list);
    expect(removeViewpoint(list, 1).map((l) => l.name)).toEqual(["L0", "L2"]);
  });

  it("writes an empty list as the key absent", () => {
    expect(viewpointsValue([])).toBeUndefined();
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
    const list = toViewpoints(JSON.parse(JSON.stringify(stored)));
    expect(list).toEqual(stored);
    expect(viewpointsValue(list)).toEqual(stored);
  });

  it("leaves an icon or description of another shape off the entry", () => {
    expect(
      toViewpoints([
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
    const out = viewpointsValue(toViewpoints(JSON.parse(JSON.stringify(list))));
    expect(out).toEqual(list);
    for (const entry of out ?? []) {
      expect(Object.keys(entry).sort()).toEqual(["lat", "lng", "name"]);
    }
  });

  it("builds an entry with the optional keys only when set", () => {
    const base = { name: "A", lat: 1, lng: 2 };
    expect(makeViewpoint(base)).toEqual(base);
    expect(Object.keys(makeViewpoint(base, null, "   "))).toEqual(["name", "lat", "lng"]);
    expect(
      makeViewpoint(base, { source: "library", id: "cookie" }, "  Cocoa  ")
    ).toEqual({ ...base, icon: { source: "library", id: "cookie" }, description: "Cocoa" });
  });

  it("caps the description at the schema's maxLength", () => {
    expect(MAX_VIEWPOINT_DESCRIPTION).toBe(
      landmarkSchema.properties.description.maxLength
    );
    const long = "x".repeat(MAX_VIEWPOINT_DESCRIPTION + 20);
    expect(makeViewpoint({ name: "A", lat: 1, lng: 2 }, null, long).description).toHaveLength(
      MAX_VIEWPOINT_DESCRIPTION
    );
  });
});
