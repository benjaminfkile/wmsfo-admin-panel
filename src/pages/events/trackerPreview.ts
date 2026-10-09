import type { Event, TrackerMap, TrackerTheme } from "../../api/types";
import { bboxContains, toBbox, type Bbox } from "../../components/bbox/bbox";

// What a new event's tracker copies, by the API's create rule: the map
// and the enabled theme set of the event with the greatest `year`, the
// map only when its package contains the new box (admin.md 6.3).
export function trackerPreviewLine(
  events: readonly Event[],
  maps: readonly TrackerMap[],
  themes: readonly TrackerTheme[],
  box: Bbox,
): string {
  if (events.length === 0) {
    return "Will use every theme, and the Missoula valley map when it covers this area";
  }
  const latest = events.reduce((a, b) => (Number(a.year) >= Number(b.year) ? a : b));
  const ids = (latest.trackerThemeIds ?? []).map(Number);
  const names = themes
    .filter((t) => ids.includes(Number(t.id)))
    .map((t) => t.name ?? `#${String(t.id)}`)
    .join(", ");
  const themePart = `the themes ${names === "" ? "none" : names} from ${latest.name ?? ""}`;
  if (latest.trackerMapId == null) return `Will use no map and ${themePart}`;
  const map = maps.find((m) => Number(m.id) === Number(latest.trackerMapId));
  const mapBox = toBbox(map?.bbox);
  if (map && mapBox && bboxContains(mapBox, box)) {
    return `Will use the map ${map.name ?? ""} and ${themePart}`;
  }
  return `Will use no map (the map of ${latest.name ?? ""} does not cover this area) and ${themePart}`;
}
