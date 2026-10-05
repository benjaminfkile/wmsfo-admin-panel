// The places both maps label, Site settings `places` (admin.md 6.16).
// Each category is one human label over a set of place kinds; a map's
// part of `places` stores the union of the checked categories as `kinds`,
// and that map labels only those kinds.
//
// POI_CATEGORIES are the route map's: the kinds are the `kind` values the
// basemap tiles carry on the `pois` layer, where the Protomaps basemap
// build writes the OpenStreetMap tag value (amenity, shop, tourism,
// leisure) as the kind. A kind may sit in more than one category
// (convenience stores are both a store and a gas stop); the stored list
// holds each kind once. TRACKER_KINDS are the live tracker's: the nine
// Google-supplied place kinds, one per category.

export interface PoiCategory {
  id: string;
  label: string;
  kinds: readonly string[];
}

export const POI_CATEGORIES: readonly PoiCategory[] = [
  {
    id: "stores",
    label: "Groceries and stores",
    kinds: [
      "supermarket", "grocery", "greengrocer", "bakery", "butcher",
      "convenience", "department_store", "mall", "hardware", "books",
      "clothes", "electronics", "beauty", "gift", "florist",
    ],
  },
  {
    id: "food",
    label: "Food and drink",
    kinds: ["restaurant", "fast_food", "cafe", "bar", "pub", "ice_cream", "food_court"],
  },
  {
    id: "parks",
    label: "Parks and playgrounds",
    kinds: ["park", "playground", "garden", "dog_park", "nature_reserve", "picnic_site"],
  },
  {
    id: "schools",
    label: "Schools",
    kinds: ["school", "kindergarten", "college", "university"],
  },
  {
    id: "churches",
    label: "Churches",
    kinds: ["place_of_worship"],
  },
  {
    id: "health",
    label: "Health",
    kinds: ["hospital", "clinic", "doctors", "dentist", "pharmacy"],
  },
  {
    id: "gas",
    label: "Gas and convenience",
    kinds: ["fuel", "convenience", "charging_station"],
  },
  {
    id: "hotels",
    label: "Hotels",
    kinds: ["hotel", "motel", "hostel", "guest_house"],
  },
  {
    id: "fun",
    label: "Fun and attractions",
    kinds: [
      "attraction", "museum", "zoo", "aquarium", "theme_park", "cinema",
      "theatre", "bowling_alley", "stadium", "sports_centre", "water_park",
      "artwork", "gallery", "viewpoint",
    ],
  },
];

export const TRACKER_KINDS: readonly PoiCategory[] = [
  { id: "attraction", label: "Attractions", kinds: ["attraction"] },
  { id: "business", label: "Businesses and shops", kinds: ["business"] },
  { id: "government", label: "Government", kinds: ["government"] },
  { id: "medical", label: "Medical", kinds: ["medical"] },
  { id: "park", label: "Parks", kinds: ["park"] },
  { id: "place_of_worship", label: "Churches", kinds: ["place_of_worship"] },
  { id: "school", label: "Schools", kinds: ["school"] },
  { id: "sports_complex", label: "Sports", kinds: ["sports_complex"] },
  { id: "transit", label: "Transit", kinds: ["transit"] },
];

export interface PoisValue {
  kinds: string[];
}

// The stored kinds of a map's places value, or null when the value is absent
// or not the stored shape (the Default choice).
export function storedKinds(value: unknown): string[] | null {
  if (value === null || typeof value !== "object") return null;
  const kinds = (value as { kinds?: unknown }).kinds;
  if (!Array.isArray(kinds)) return null;
  return kinds.filter((k): k is string => typeof k === "string");
}

// The union of the kinds of the given categories, each kind once, in
// table order.
export function kindsFor(
  categoryIds: Iterable<string>,
  categories: readonly PoiCategory[] = POI_CATEGORIES
): string[] {
  const chosen = new Set(categoryIds);
  const out = new Set<string>();
  for (const c of categories) {
    if (!chosen.has(c.id)) continue;
    for (const k of c.kinds) out.add(k);
  }
  return [...out];
}

// The categories shown checked for a stored kind list: those whose every
// kind is in the list.
export function categoriesFor(
  kinds: readonly string[],
  categories: readonly PoiCategory[] = POI_CATEGORIES
): string[] {
  const have = new Set(kinds);
  return categories.filter((c) => c.kinds.every((k) => have.has(k))).map(
    (c) => c.id
  );
}

// A map's places value for a choice: Default is absent (undefined); Custom
// is the union of the checked categories plus any stored kind no category
// names, so a kind set elsewhere is kept.
export function poisFor(
  choice: "default" | "custom",
  categoryIds: Iterable<string>,
  keep: readonly string[] = [],
  categories: readonly PoiCategory[] = POI_CATEGORIES
): PoisValue | undefined {
  if (choice === "default") return undefined;
  const known = new Set(categories.flatMap((c) => c.kinds));
  const kinds = new Set(kindsFor(categoryIds, categories));
  for (const k of keep) if (!known.has(k)) kinds.add(k);
  return { kinds: [...kinds] };
}

export interface PlacesValue {
  tracker?: PoisValue;
  routeMap?: PoisValue;
}

export type PlacesPart = keyof PlacesValue;

// The stored part of a `places` value, or undefined when it is absent or
// not the stored shape (Default).
export function placesPart(value: unknown, part: PlacesPart): PoisValue | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const kinds = storedKinds((value as Record<string, unknown>)[part]);
  return kinds === null ? undefined : { kinds };
}

// `places` with one part replaced: a Default part has no key, and a value
// with both parts Default is undefined, so the saved document carries
// `places` only when set.
export function withPlacesPart(
  value: unknown,
  part: PlacesPart,
  next: PoisValue | undefined
): PlacesValue | undefined {
  const out: PlacesValue = {};
  const tracker = part === "tracker" ? next : placesPart(value, "tracker");
  const routeMap = part === "routeMap" ? next : placesPart(value, "routeMap");
  if (tracker) out.tracker = tracker;
  if (routeMap) out.routeMap = routeMap;
  return Object.keys(out).length === 0 ? undefined : out;
}
