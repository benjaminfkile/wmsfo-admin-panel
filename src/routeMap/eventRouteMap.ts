// An event's route map: its `routeMapConfig` (RouteMapConfig in
// primitives.schema.json) as the panel edits it, the values the site
// resolves from it (santa's routeMapConfig.ts rules), the summary the
// event page shows, and `eventRouteMapStyle`, the one style call the
// route map modal's live preview draws with.
//
// Every group and every key is optional. The site resolves each value on
// its own: a display key falls back to its built-in default, and each
// control is on unless the config says false. A config with no group is
// stored as null.

import type { StyleSpecification } from "maplibre-gl";
import type { Config } from "../config";
import { ROUTE_MAP_DISPLAY_LABELS } from "../components/content/labels";
import { toLandmarks, type Landmark } from "../components/content/landmarks";
import {
  ROUTE_MAP_DEFAULTS,
  ROUTE_MAP_DISPLAY_KEYS,
  readDisplayKey,
  resolveDisplayKey,
  type RouteMapDisplay,
} from "../components/content/routeMapDisplay";
import { storedKinds, type PoisValue } from "../components/content/routePreviewPois";
import type { Appearance } from "./flavors";
import { buildRouteMapStyle } from "./index";
import type { RouteMapData } from "./poster";
import { formatElapsed } from "./posterStyle";
import type { StyleOptions, TimeLabel } from "./style";

export type RouteMapControlKey = "fullscreen" | "terrain";

export type RouteMapControls = Partial<Record<RouteMapControlKey, boolean>>;

export interface RouteMapConfigValue {
  display?: RouteMapDisplay;
  controls?: RouteMapControls;
  landmarks?: Landmark[];
  pois?: PoisValue;
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
// it is a contract value, each control only when boolean, the landmarks
// of the stored shape, and the POI kinds when a list is stored. A group
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

  const landmarks = toLandmarks(record.landmarks);
  if (landmarks.length > 0) out.landmarks = landmarks;

  const kinds = storedKinds(record.pois);
  if (kinds !== null) out.pois = { kinds };

  return out;
}

// A copy of `config` with one group replaced, or removed when `value` is
// undefined, an empty object, or an empty landmark list.
export function withGroup<K extends RouteMapGroup>(
  config: RouteMapConfigValue,
  key: K,
  value: RouteMapConfigValue[K] | undefined
): RouteMapConfigValue {
  const next = { ...config };
  const empty =
    value === undefined ||
    (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0);
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
  landmarks: Landmark[] | undefined;
  poiKinds: string[] | undefined;
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
    landmarks: config.landmarks,
    poiKinds: config.pois?.kinds,
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

export interface EventRouteMapStyleInput {
  appearance: Appearance;
  routeMap: RouteMapData;
  routeMapConfig: RouteMapConfigValue;
  // The hillshade, drawn only while the config keeps the terrain toggle.
  terrain: boolean;
}

// The style options the site builds for a config over a route map.
export function eventRouteMapOptions(
  routeMap: RouteMapData,
  routeMapConfig: RouteMapConfigValue
): StyleOptions {
  const resolved = resolveRouteMapConfig(routeMapConfig);
  return {
    timeLabels: siteTimeLabels(routeMap.timeline, resolved.timeLabelIntervalMinutes),
    ...(resolved.poiKinds !== undefined ? { poiKinds: resolved.poiKinds } : {}),
    ...(resolved.landmarks !== undefined
      ? {
          landmarks: resolved.landmarks.map((l) => ({ lat: l.lat, lng: l.lng, label: l.name })),
        }
      : {}),
    ...(resolved.arrows ? { arrows: true } : {}),
    arrowScale: resolved.arrowScale,
    routeWidthScale: resolved.routeWidthScale,
    labelScale: resolved.labelScale,
  };
}

// The site's route map for the event: the path with every timeline point
// as a mark, the time labels, landmarks, POI kinds, arrows, widths, and
// label scale of the config, and the hillshade when `terrain` is set and the config
// keeps the terrain toggle.
export function eventRouteMapStyle(
  config: Pick<Config, "routeBasemapUrl">,
  input: EventRouteMapStyleInput
): StyleSpecification {
  const { routeMap, routeMapConfig } = input;
  const terrain = input.terrain && readControl(routeMapConfig.controls, "terrain");
  return buildRouteMapStyle(
    config,
    input.appearance,
    routeMap.path,
    routeMap.timeline.map((t) => ({ lat: t.lat, lng: t.lng })),
    terrain,
    eventRouteMapOptions(routeMap, routeMapConfig)
  );
}

export interface RouteMapSummaryItem {
  label: string;
  value: string;
}

export interface RouteMapSummary {
  landmarks: number;
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
  if (config.pois) changed.push({ label: "Points of interest", value: "Custom" });
  return { landmarks: config.landmarks?.length ?? 0, changed };
}
