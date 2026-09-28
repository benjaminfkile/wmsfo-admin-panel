// The Points of interest choice of the route_preview form (admin.md
// 6.14). Each category is one human label over a set of basemap POI
// kinds; the section stores the union of the checked categories as
// `pois.kinds`, and the site's route map labels only those kinds.
//
// The kinds are the `kind` values the basemap tiles carry on the `pois`
// layer: the Protomaps basemap build writes the OpenStreetMap tag value
// (amenity, shop, tourism, leisure) as the kind. A kind may sit in more
// than one category (convenience stores are both a store and a gas stop);
// the stored list holds each kind once.

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

const KNOWN_KINDS = new Set(POI_CATEGORIES.flatMap((c) => c.kinds));

export interface PoisValue {
  kinds: string[];
}

// The stored kinds of a `pois` value, or null when the value is absent
// or not the stored shape (the Default choice).
export function storedKinds(value: unknown): string[] | null {
  if (value === null || typeof value !== "object") return null;
  const kinds = (value as { kinds?: unknown }).kinds;
  if (!Array.isArray(kinds)) return null;
  return kinds.filter((k): k is string => typeof k === "string");
}

// The union of the kinds of the given categories, each kind once, in
// table order.
export function kindsFor(categoryIds: Iterable<string>): string[] {
  const chosen = new Set(categoryIds);
  const out = new Set<string>();
  for (const c of POI_CATEGORIES) {
    if (!chosen.has(c.id)) continue;
    for (const k of c.kinds) out.add(k);
  }
  return [...out];
}

// The categories shown checked for a stored kind list: those whose every
// kind is in the list.
export function categoriesFor(kinds: readonly string[]): string[] {
  const have = new Set(kinds);
  return POI_CATEGORIES.filter((c) => c.kinds.every((k) => have.has(k))).map(
    (c) => c.id
  );
}

// The `pois` value for a choice: Default is absent (undefined); Custom is
// the union of the checked categories plus any stored kind no category
// names, so a kind set elsewhere is kept.
export function poisFor(
  choice: "default" | "custom",
  categoryIds: Iterable<string>,
  keep: readonly string[] = []
): PoisValue | undefined {
  if (choice === "default") return undefined;
  const kinds = new Set(kindsFor(categoryIds));
  for (const k of keep) if (!KNOWN_KINDS.has(k)) kinds.add(k);
  return { kinds: [...kinds] };
}
