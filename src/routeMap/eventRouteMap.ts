// An event's route map: its `routeMapConfig` (RouteMapConfig in
// primitives.schema.json) as the panel edits it, the values the site
// resolves from it (santa's routeMapConfig.ts rules), the summary the
// event page shows, the theme and map the preview draws
// (`eventRouteMapSource`), and `eventRouteMapStyle`, the one style call
// the route map modal's live preview draws with.
//
// Every group and every key is optional. The site resolves each value on
// its own: a display key falls back to its built-in default, and each
// control is on unless the config says false. A config with no group is
// stored as null.

import type { StyleSpecification } from "maplibre-gl";
import type { Event, TrackerMap, TrackerTheme } from "../api/types";
import { ROUTE_MAP_DISPLAY_LABELS } from "../components/content/labels";
import {
  ROUTE_MAP_DEFAULTS,
  ROUTE_MAP_DISPLAY_KEYS,
  readDisplayKey,
  resolveDisplayKey,
  type RouteMapDisplay,
} from "../components/content/routeMapDisplay";
import type { RouteMapData } from "./poster";
import { formatElapsed, type StyleMap, type ThemeWithBody } from "./posterStyle";
import {
  themeOverlay,
  withRouteLayers,
  type RouteLayerOptions,
  type TimeLabel,
} from "./routeLayers";
import { applyMap } from "./themeStyle";

export type RouteMapControlKey = "fullscreen" | "terrain";

export type RouteMapControls = Partial<Record<RouteMapControlKey, boolean>>;

export interface RouteMapConfigValue {
  display?: RouteMapDisplay;
  controls?: RouteMapControls;
}

export type RouteMapGroup = keyof RouteMapConfigValue;

export const ROUTE_MAP_CONTROL_KEYS: RouteMapControlKey[] = ["fullscreen", "terrain"];

export const ROUTE_MAP_CONTROL_LABELS: Record<RouteMapControlKey, { label: string; help: string }> = {
  fullscreen: {
    label: "Fullscreen button",
    help: "Lets visitors open the route map full screen.",
  },
  terrain: {
    label: "Terrain toggle",
    help: "Lets visitors shade the hills under the route.",
  },
};

// The multipliers the style takes for the named sizes.
export const DISPLAY_SCALES: {
  arrowSize: Readonly<Record<string, number>>;
  routeWidth: Readonly<Record<string, number>>;
  labelSize: Readonly<Record<string, number>>;
} = {
  arrowSize: { small: 0.75, medium: 1, large: 1.5, xlarge: 2 },
  routeWidth: { thin: 0.75, normal: 1, thick: 1.5, xthick: 2 },
  labelSize: { small: 0.8, medium: 1, large: 1.3 },
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

// The editable form of a stored config: each display key kept only when
// it is a contract value and each control only when boolean. A group
// left with nothing in it is absent, so null and `{}` both read as `{}`.
export function toRouteMapConfig(raw: unknown): RouteMapConfigValue {
  const record = asRecord(raw);
  if (!record) return {};
  const out: RouteMapConfigValue = {};

  const display: RouteMapDisplay = {};
  for (const key of ROUTE_MAP_DISPLAY_KEYS) {
    const v = readDisplayKey(record.display, key);
    if (v !== undefined) display[key] = v;
  }
  if (Object.keys(display).length > 0) out.display = display;

  const storedControls = asRecord(record.controls);
  const controls: RouteMapControls = {};
  for (const key of ROUTE_MAP_CONTROL_KEYS) {
    const v = storedControls?.[key];
    if (typeof v === "boolean") controls[key] = v;
  }
  if (Object.keys(controls).length > 0) out.controls = controls;

  return out;
}

// A copy of `config` with one group replaced, or removed when `value` is
// undefined or an empty object.
export function withGroup<K extends RouteMapGroup>(
  config: RouteMapConfigValue,
  key: K,
  value: RouteMapConfigValue[K] | undefined
): RouteMapConfigValue {
  const next = { ...config };
  const empty = value === undefined || Object.keys(value).length === 0;
  if (empty) delete next[key];
  else next[key] = value;
  return next;
}

// The value saved on the event: the config, or null when it has no group.
export function routeMapConfigBody(config: RouteMapConfigValue): RouteMapConfigValue | null {
  const clean = toRouteMapConfig(config);
  return Object.keys(clean).length === 0 ? null : clean;
}

// A control is on unless it is stored as false.
export function readControl(
  controls: RouteMapControls | undefined,
  key: RouteMapControlKey
): boolean {
  return controls?.[key] !== false;
}

// The controls with `key` written as `on`; a flipped switch always
// writes its value, true included.
export function withControl(
  controls: RouteMapControls | undefined,
  key: RouteMapControlKey,
  on: boolean
): RouteMapControls {
  return { ...(controls ?? {}), [key]: on };
}

export interface ResolvedRouteMapConfig {
  timeLabelIntervalMinutes: number;
  arrows: boolean;
  arrowScale: number;
  routeWidthScale: number;
  labelScale: number;
  controls: Record<RouteMapControlKey, boolean>;
}

// The values the site draws with for a config.
export function resolveRouteMapConfig(config: RouteMapConfigValue): ResolvedRouteMapConfig {
  const levels = [config.display];
  return {
    timeLabelIntervalMinutes: Number(resolveDisplayKey(levels, "timeLabelIntervalMinutes")),
    arrows: resolveDisplayKey(levels, "arrows") === true,
    arrowScale: DISPLAY_SCALES.arrowSize[String(resolveDisplayKey(levels, "arrowSize"))] ?? 1,
    routeWidthScale:
      DISPLAY_SCALES.routeWidth[String(resolveDisplayKey(levels, "routeWidth"))] ?? 1,
    labelScale: DISPLAY_SCALES.labelSize[String(resolveDisplayKey(levels, "labelSize"))] ?? 1,
    controls: {
      fullscreen: readControl(config.controls, "fullscreen"),
      terrain: readControl(config.controls, "terrain"),
    },
  };
}

type TimelineEntry = RouteMapData["timeline"][number];

// The site's time labels: one at every timeline entry strictly between
// the first and the last whose minute is a positive multiple of `every`,
// as elapsed time ("45m", "1h 15m"). An interval of 0 gives none.
export function siteTimeLabels(timeline: readonly TimelineEntry[], every: number): TimeLabel[] {
  const out: TimeLabel[] = [];
  if (!(every > 0)) return out;
  const sorted = [...timeline].sort((a, b) => a.minutes - b.minutes);
  for (let i = 1; i < sorted.length - 1; i++) {
    const { minutes, lat, lng } = sorted[i]!;
    if (minutes > 0 && minutes % every === 0) {
      out.push({ lat, lng, label: formatElapsed(minutes) });
    }
  }
  return out;
}

export type Appearance = "light" | "dark";

export const NO_MAP_HINT =
  "This event has no tracker map, so the site draws its route map on Google Maps. Choose one under Tracker map to preview it here.";
export const NO_THEME_HINT = "Enable a MapLibre theme under Tracker map to preview the route map.";

export type EventRouteMapSource =
  | { theme: TrackerTheme; map: TrackerMap; hint: null }
  | { theme: null; map: null; hint: string };

function bySortOrder(a: TrackerTheme, b: TrackerTheme): number {
  return (
    Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
    Number(a.id ?? 0) - Number(b.id ?? 0)
  );
}

// What the preview draws for the event and the appearance, the way the
// site's route mode does: the event's tracker map, and among its enabled
// MapLibre themes (in their order) the one carrying the default flag for
// the appearance, else the first. Without a map, or without an enabled
// MapLibre theme, the one-line hint instead.
export function eventRouteMapSource(
  event: Pick<Event, "trackerMapId" | "trackerThemeIds">,
  maps: readonly TrackerMap[],
  themes: readonly TrackerTheme[],
  appearance: Appearance,
): EventRouteMapSource {
  const mapId = event.trackerMapId;
  const map =
    mapId === null || mapId === undefined
      ? undefined
      : maps.find((m) => Number(m.id) === Number(mapId));
  if (!map) return { theme: null, map: null, hint: NO_MAP_HINT };
  const enabled = new Set((event.trackerThemeIds ?? []).map(Number));
  const candidates = themes
    .filter((t) => t.renderer === "maplibre" && enabled.has(Number(t.id)))
    .sort(bySortOrder);
  const flagged = candidates.find((t) =>
    appearance === "dark" ? t.defaultDarkMode === true : t.defaultLightMode === true,
  );
  const theme = flagged ?? candidates[0];
  if (!theme) return { theme: null, map: null, hint: NO_THEME_HINT };
  return { theme, map, hint: null };
}

export interface EventRouteMapStyleInput {
  // The event's MapLibre theme with its body loaded.
  theme: ThemeWithBody;
  // The event's tracker map.
  map: StyleMap;
  routeMap: RouteMapData;
  routeMapConfig: RouteMapConfigValue;
  // The hillshade, drawn only while the config keeps the terrain toggle.
  terrain: boolean;
  // The place kinds the map labels (Site settings `places.routeMap.kinds`);
  // undefined labels none.
  poiKinds?: readonly string[];
}

// The route layer options the site builds for a config over a route map.
export function eventRouteMapOptions(
  routeMap: RouteMapData,
  routeMapConfig: RouteMapConfigValue,
): RouteLayerOptions {
  const resolved = resolveRouteMapConfig(routeMapConfig);
  return {
    timeLabels: siteTimeLabels(routeMap.timeline, resolved.timeLabelIntervalMinutes),
    ...(resolved.arrows ? { arrows: true } : {}),
    arrowScale: resolved.arrowScale,
    routeWidthScale: resolved.routeWidthScale,
    labelScale: resolved.labelScale,
  };
}

// The site's route map for the event: the theme body over the event's
// map with the places layers kept to the input's kinds, the hillshade
// when `terrain` is set, the config keeps the terrain toggle, and the map
// has a terrain file, and the route in the theme's overlay colours with
// every timeline point as a mark and the time labels, arrows, widths, and
// label scale of the config.
export function eventRouteMapStyle(input: EventRouteMapStyleInput): StyleSpecification {
  const { routeMap, routeMapConfig } = input;
  const terrain = input.terrain && readControl(routeMapConfig.controls, "terrain");
  const base = applyMap(input.theme.body, input.map, {
    terrain,
    poiKinds: input.poiKinds ?? [],
  });
  return withRouteLayers(
    base,
    themeOverlay(input.theme),
    routeMap.path,
    routeMap.timeline.map((t) => ({ lat: t.lat, lng: t.lng })),
    eventRouteMapOptions(routeMap, routeMapConfig),
  );
}

export interface RouteMapSummaryItem {
  label: string;
  value: string;
}

export interface RouteMapSummary {
  // The settings whose value is not the default, in the modal's order.
  changed: RouteMapSummaryItem[];
}

// What the event page's Route map card says about a config.
export function routeMapConfigSummary(config: RouteMapConfigValue): RouteMapSummary {
  const changed: RouteMapSummaryItem[] = [];
  for (const key of ROUTE_MAP_DISPLAY_KEYS) {
    const v = readDisplayKey(config.display, key);
    if (v === undefined || v === ROUTE_MAP_DEFAULTS[key]) continue;
    const entry = ROUTE_MAP_DISPLAY_LABELS[key];
    changed.push({ label: entry?.label ?? key, value: entry?.options?.[String(v)] ?? String(v) });
  }
  for (const key of ROUTE_MAP_CONTROL_KEYS) {
    if (!readControl(config.controls, key)) {
      changed.push({ label: ROUTE_MAP_CONTROL_LABELS[key].label, value: "Off" });
    }
  }
  return { changed };
}
