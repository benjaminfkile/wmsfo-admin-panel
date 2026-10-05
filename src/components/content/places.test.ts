import { describe, expect, it } from "vitest";
import siteSettings from "../../../contracts/schema/site-settings.schema.json";
import {
  POI_CATEGORIES,
  TRACKER_KINDS,
  categoriesFor,
  kindsFor,
  placesPart,
  poisFor,
  storedKinds,
  withPlacesPart,
} from "./places";

const kindsSchema = siteSettings.properties.places.properties.routeMap.properties.kinds;
const trackerEnum = siteSettings.properties.places.properties.tracker.properties.kinds.items.enum;

describe("the POI category table", () => {
  it("has the nine human categories, each over at least one kind", () => {
    expect(POI_CATEGORIES.map((c) => c.label)).toEqual([
      "Groceries and stores",
      "Food and drink",
      "Parks and playgrounds",
      "Schools",
      "Churches",
      "Health",
      "Gas and convenience",
      "Hotels",
      "Fun and attractions",
    ]);
    for (const c of POI_CATEGORIES) expect(c.kinds.length).toBeGreaterThan(0);
  });

  it("holds only kinds the schema accepts, and all of them fit the cap", () => {
    const pattern = new RegExp(kindsSchema.items.pattern);
    const all = kindsFor(POI_CATEGORIES.map((c) => c.id));
    for (const k of all) {
      expect(k).toMatch(pattern);
      expect(k.length).toBeLessThanOrEqual(kindsSchema.items.maxLength);
    }
    expect(all.length).toBeLessThanOrEqual(kindsSchema.maxItems);
  });
});

describe("the tracker kind table", () => {
  it("has one category per Google kind, in the schema's order", () => {
    expect(TRACKER_KINDS.map((c) => c.kinds)).toEqual(trackerEnum.map((k) => [k]));
    expect(TRACKER_KINDS.map((c) => c.label)).toEqual([
      "Attractions",
      "Businesses and shops",
      "Government",
      "Medical",
      "Parks",
      "Churches",
      "Schools",
      "Sports",
      "Transit",
    ]);
  });

  it("writes and reads tracker kinds through the same helpers", () => {
    expect(poisFor("custom", ["park", "school"], [], TRACKER_KINDS)).toEqual({
      kinds: ["park", "school"],
    });
    expect(categoriesFor(["transit"], TRACKER_KINDS)).toEqual(["transit"]);
  });
});

describe("kindsFor", () => {
  it("writes the union of the checked categories' kinds", () => {
    const food = POI_CATEGORIES.find((c) => c.id === "food")!;
    const churches = POI_CATEGORIES.find((c) => c.id === "churches")!;
    expect(kindsFor(["food", "churches"])).toEqual([...food.kinds, ...churches.kinds]);
  });

  it("holds a kind two categories share once", () => {
    const kinds = kindsFor(["stores", "gas"]);
    expect(kinds.filter((k) => k === "convenience")).toEqual(["convenience"]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("is empty with nothing checked", () => {
    expect(kindsFor([])).toEqual([]);
  });
});

describe("poisFor", () => {
  it("writes the key absent for Default", () => {
    expect(poisFor("default", ["food"])).toBeUndefined();
  });

  it("writes an empty list for Custom with nothing checked", () => {
    expect(poisFor("custom", [])).toEqual({ kinds: [] });
  });

  it("writes the union for Custom with categories checked", () => {
    expect(poisFor("custom", ["churches", "hotels"])).toEqual({
      kinds: ["place_of_worship", "hotel", "motel", "hostel", "guest_house"],
    });
  });

  it("keeps a stored kind no category names", () => {
    expect(poisFor("custom", ["churches"], ["place_of_worship", "lighthouse"])).toEqual({
      kinds: ["place_of_worship", "lighthouse"],
    });
  });
});

describe("reading a stored value", () => {
  it("reads absent as Default and a kinds list as Custom", () => {
    expect(storedKinds(undefined)).toBeNull();
    expect(storedKinds({ kinds: [] })).toEqual([]);
  });

  it("checks a category only when all of its kinds are stored", () => {
    expect(categoriesFor(kindsFor(["health", "schools"]))).toEqual(["schools", "health"]);
    expect(categoriesFor(["hospital"])).toEqual([]);
  });
});

describe("the places value", () => {
  it("writes a part without the key of a Default part, and undefined when both are Default", () => {
    expect(withPlacesPart(undefined, "tracker", { kinds: ["park"] })).toEqual({
      tracker: { kinds: ["park"] },
    });
    const both = withPlacesPart({ tracker: { kinds: ["park"] } }, "routeMap", { kinds: [] });
    expect(both).toEqual({ tracker: { kinds: ["park"] }, routeMap: { kinds: [] } });
    expect(withPlacesPart(both, "tracker", undefined)).toEqual({ routeMap: { kinds: [] } });
    expect(withPlacesPart({ routeMap: { kinds: [] } }, "routeMap", undefined)).toBeUndefined();
  });

  it("reads a part, absent or malformed as Default", () => {
    expect(placesPart({ routeMap: { kinds: ["school"] } }, "routeMap")).toEqual({ kinds: ["school"] });
    expect(placesPart({ routeMap: { kinds: ["school"] } }, "tracker")).toBeUndefined();
    expect(placesPart(null, "routeMap")).toBeUndefined();
    expect(placesPart({ routeMap: "school" }, "routeMap")).toBeUndefined();
  });
});
