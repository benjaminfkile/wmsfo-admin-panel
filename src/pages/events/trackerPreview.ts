import type { Event, TrackerMap, TrackerTheme } from "../../api/types";
import { bboxContains, type Bbox } from "../../components/bbox/bbox";
import { findMap, mapArea, type TrackerArea } from "../../components/events/trackerArea";
import type { StartView } from "../../components/events/startView";

function latestEvent(events: readonly Event[]): Event | null {
  if (events.length === 0) return null;
  return events.reduce((a, b) => (Number(a.year) >= Number(b.year) ? a : b));
}

// Where the create dialog's map choice starts: the map the API would
// inherit, the greatest-year event's map while it is ready, so an
// unchanged dialog behaves as before. The box is the site default when
// that map's area contains it, else the map's area; with no such map,
// No map and the site default.
export function initialCreateArea(
  events: readonly Event[],
  maps: readonly TrackerMap[] | undefined,
  siteBox: Bbox,
): TrackerArea {
  const latest = latestEvent(events);
  const id = latest?.trackerMapId == null ? null : Number(latest.trackerMapId);
  const map = findMap(maps, id);
  const area = mapArea(map);
  if (!map || map.state !== "ready" || !area) return { mapId: null, bbox: siteBox };
  return { mapId: id, bbox: bboxContains(area, siteBox) ? siteBox : area };
}

// What a new event's tracker gets (admin.md 6.3): the chosen map, or no
// map, and the enabled theme set the API copies from the event with the
// greatest `year` (every theme with no event), and where it opens: the
// whole area, or the start view's centre and zoom.
export function trackerPreviewLine(
  events: readonly Event[],
  themes: readonly TrackerTheme[],
  map: TrackerMap | null,
  startView: StartView | null = null,
): string {
  const mapPart = map ? `the map ${map.name ?? ""}` : "no map";
  const opens =
    startView === null
      ? "opening on the whole area"
      : `opening at ${startView.center.lat.toFixed(5)}, ${startView.center.lng.toFixed(5)}, zoom ${startView.zoom}`;
  const latest = latestEvent(events);
  if (latest === null) return `Will use ${mapPart} and every theme, ${opens}`;
  const ids = (latest.trackerThemeIds ?? []).map(Number);
  const names = themes
    .filter((t) => ids.includes(Number(t.id)))
    .map((t) => t.name ?? `#${String(t.id)}`)
    .join(", ");
  return `Will use ${mapPart} and the themes ${names === "" ? "none" : names} from ${latest.name ?? ""}, ${opens}`;
}
