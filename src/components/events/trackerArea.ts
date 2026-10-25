import type { TrackerMap } from "../../api/types";
import { toBbox, type Bbox } from "../bbox/bbox";

// An event's map choice and box together: the map's id, or null for No
// map (Google Maps for every viewer), and the box inside its area.
export type TrackerArea = { mapId: number | null; bbox: Bbox };

// The maps the choice lists: every ready map, by name.
export function readyMaps(items: readonly TrackerMap[] | undefined): TrackerMap[] {
  return (items ?? [])
    .filter((m) => m.state === "ready")
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

export function findMap(
  items: readonly TrackerMap[] | undefined,
  id: number | null,
): TrackerMap | null {
  if (id === null) return null;
  return (items ?? []).find((m) => Number(m.id) === id) ?? null;
}

// The area a map limits the box to, or null without a map.
export function mapArea(map: TrackerMap | null): Bbox | null {
  return map ? toBbox(map.bbox) : null;
}

// "With terrain" or "No terrain", from the row's `terrainUrl`, which
// follows `terrainMaxZoom`; never from a size.
export function terrainWord(map: TrackerMap): string {
  return map.terrainUrl ? "With terrain" : "No terrain";
}
