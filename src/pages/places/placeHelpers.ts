import type { Place } from "../../api/types";

// A row for the /places tree table. `depth` is the number of ancestors,
// `childCount` is used to render the caret only when the row has any.
export type TreeRow = {
  place: Place;
  depth: number;
  childCount: number;
  ancestors: number[];
};

// The API answers in tree order (parents before children, siblings by
// name; contracts 4.5a). This helper reshapes that list into a
// depth-annotated list the table renders, without changing sibling
// order.
export function toTree(places: Place[]): TreeRow[] {
  const byParent = new Map<number | null, Place[]>();
  for (const p of places) {
    const key = p.parentId;
    const list = byParent.get(key);
    if (list) list.push(p);
    else byParent.set(key, [p]);
  }
  const out: TreeRow[] = [];
  const walk = (parentId: number | null, depth: number, ancestors: number[]) => {
    const children = byParent.get(parentId) ?? [];
    for (const p of children) {
      const childrenOfP = byParent.get(p.id) ?? [];
      out.push({
        place: p,
        depth,
        childCount: childrenOfP.length,
        ancestors,
      });
      walk(p.id, depth + 1, [...ancestors, p.id]);
    }
  };
  walk(null, 0, []);
  return out;
}

// admin.md 6.24 location cell states:
// - "Pinned" when the row has its own pin (place.location != null).
// - "Uses <ancestor>" when the row resolves to an ancestor's pin
//   (place.pin is set and pin.fromPlaceId is not this place).
// - "Not pinned yet" (warning) when nothing resolves and the subtree
//   has scans.
// - "No pin" (muted) otherwise.
export type LocationCell =
  | { kind: "pinned" }
  | { kind: "uses"; fromName: string }
  | { kind: "warning" }
  | { kind: "none" };

export function locationCellFor(
  place: Place,
  byId: Map<number, Place>,
): LocationCell {
  if (place.location) return { kind: "pinned" };
  if (place.pin) {
    const anc = byId.get(place.pin.fromPlaceId);
    return { kind: "uses", fromName: anc?.name ?? "an ancestor" };
  }
  if (place.scans.people > 0) return { kind: "warning" };
  return { kind: "none" };
}
