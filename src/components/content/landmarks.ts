// The landmarks list of the route_preview form (admin.md 6.14): named
// points the site's route map draws as a dot with the name beside it.

export interface Landmark {
  name: string;
  lat: number;
  lng: number;
}

// The schema's `maxItems` for `landmarks`.
export const MAX_LANDMARKS = 50;

// Where the pin picker opens with no landmark yet: the map section's
// default centre.
export const DEFAULT_LANDMARK_CENTER = { lat: 46.87, lng: -114 };

// Longest name the schema allows.
export const MAX_LANDMARK_NAME = 80;

// Five decimals is about a metre, finer than a click on the map.
export function roundCoord(n: number): number {
  return Math.round(n * 100000) / 100000;
}

// The landmarks of a stored value; entries that are not the stored shape
// are dropped.
export function toLandmarks(value: unknown): Landmark[] {
  if (!Array.isArray(value)) return [];
  const out: Landmark[] = [];
  for (const v of value) {
    if (v === null || typeof v !== "object") continue;
    const { name, lat, lng } = v as Record<string, unknown>;
    if (typeof name !== "string" || typeof lat !== "number" || typeof lng !== "number") {
      continue;
    }
    out.push({ name, lat, lng });
  }
  return out;
}

// Appends an entry; the list is returned unchanged at the cap.
export function addLandmark(list: readonly Landmark[], entry: Landmark): Landmark[] {
  if (list.length >= MAX_LANDMARKS) return list.slice();
  return [...list, entry];
}

export function replaceLandmark(
  list: readonly Landmark[],
  index: number,
  entry: Landmark
): Landmark[] {
  if (index < 0 || index >= list.length) return list.slice();
  const next = list.slice();
  next[index] = entry;
  return next;
}

export function removeLandmark(list: readonly Landmark[], index: number): Landmark[] {
  return list.filter((_, i) => i !== index);
}

export function moveLandmark(
  list: readonly Landmark[],
  from: number,
  to: number
): Landmark[] {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) {
    return list.slice();
  }
  const next = list.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x as Landmark);
  return next;
}

// The value written for a list: an empty list removes the key.
export function landmarksValue(list: readonly Landmark[]): Landmark[] | undefined {
  return list.length > 0 ? list.slice() : undefined;
}
