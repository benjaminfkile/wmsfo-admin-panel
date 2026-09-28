// The route styling of the poster generator: the options the dialog
// offers, the time labels drawn from the route map timeline, and the one
// style building call that both the live preview and the export render go
// through, so the two always draw the same map.

import type { StyleSpecification } from "maplibre-gl";
import type { Config } from "../config";
import { utcToWallTime } from "../lib/time";
import type { Appearance } from "./flavors";
import { ROUTE_PALETTES } from "./flavors";
import { buildRouteMapStyle } from "./index";
import { fiveMinuteMarks, type RouteMapData } from "./poster";
import type { StyleOptions, TimeLabel } from "./style";

// 0 turns the time labels off; the others are minutes between labels.
export type TimeLabelInterval = 0 | 5 | 10 | 15 | 30;
export type TimeLabelFormat = "wall" | "elapsed";

export const TIME_LABEL_INTERVALS: readonly { value: TimeLabelInterval; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 5, label: "Every 5 minutes" },
  { value: 10, label: "Every 10 minutes" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
];

export const TIME_LABEL_FORMATS: readonly { value: TimeLabelFormat; label: string }[] = [
  { value: "wall", label: "Wall clock" },
  { value: "elapsed", label: "Elapsed" },
];

export const DEFAULT_ARROWS = true;
export const DEFAULT_TIME_LABEL_INTERVAL: TimeLabelInterval = 15;
export const DEFAULT_TIME_LABEL_FORMAT: TimeLabelFormat = "wall";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// True for a six digit "#rrggbb" colour.
export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

// The route colour of the theme, the colour picker's default.
export function themeRouteColor(theme: Appearance): string {
  return ROUTE_PALETTES[theme].routeColor;
}

type TimelineEntry = RouteMapData["timeline"][number];

// The timeline entries at every whole multiple of `interval` minutes, plus
// the final entry whatever its minute. An interval of 0 yields none.
export function timeLabelEntries(
  timeline: readonly TimelineEntry[],
  interval: TimeLabelInterval,
): TimelineEntry[] {
  if (interval === 0 || timeline.length === 0) return [];
  const last = timeline[timeline.length - 1]!;
  const picked = timeline.filter(
    (t) => t !== last && Number.isInteger(t.minutes) && t.minutes % interval === 0,
  );
  return [...picked, last];
}

// "+h:mm" of the minutes since the start.
export function formatElapsed(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `+${h}:${String(m).padStart(2, "0")}`;
}

// "HH:mm" on the wall clock of `zone` at `minutes` after `scheduledAt`,
// through utcToWallTime, so daylight saving changes follow the zone; ""
// for an invalid start or an unknown zone.
export function formatWallClock(scheduledAt: string, minutes: number, zone: string): string {
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return "";
  const at = new Date(start + Math.round(minutes * 60_000)).toISOString();
  const wall = utcToWallTime(at, zone);
  return wall ? wall.slice(11) : "";
}

export type TimeLabelSettings = {
  interval: TimeLabelInterval;
  format: TimeLabelFormat;
  // The event's scheduled start; without it the labels are elapsed time.
  scheduledAt: string | null;
  // The event's schedule zone, the IANA zone of the wall clock labels.
  zone: string;
};

// The `{ lat, lng, label }` list the style draws for the chosen interval
// and format.
export function posterTimeLabels(
  timeline: readonly TimelineEntry[],
  settings: TimeLabelSettings,
): TimeLabel[] {
  const { scheduledAt } = settings;
  const wall = settings.format === "wall" && !!scheduledAt;
  return timeLabelEntries(timeline, settings.interval).map((t) => ({
    lat: t.lat,
    lng: t.lng,
    label: wall ? formatWallClock(scheduledAt, t.minutes, settings.zone) : formatElapsed(t.minutes),
  }));
}

export type PosterStyleInput = {
  theme: Appearance;
  routeMap: RouteMapData;
  terrain: boolean;
  options: StyleOptions;
};

// The poster's style: the route map over the path with the 5 minute marks,
// the hillshade when `terrain` is set, and the route styling options. The
// preview and the export render both call this with the same input.
export function buildPosterStyle(
  config: Pick<Config, "routeBasemapUrl">,
  input: PosterStyleInput,
): StyleSpecification {
  return buildRouteMapStyle(
    config,
    input.theme,
    input.routeMap.path,
    fiveMinuteMarks(input.routeMap),
    input.terrain,
    input.options,
  );
}
