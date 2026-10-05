// The site's viewpoints list (Site settings `landmarks`, admin.md 6.16):
// good spots to watch Santa fly over, which the route preview and the
// live tracker draw as a dot with the name beside it, each with an
// optional icon and a short description the site opens when a visitor
// taps the viewpoint.

import type { Icon } from "../../api/types";

export interface Viewpoint {
  name: string;
  lat: number;
  lng: number;
  icon?: Icon;
  description?: string;
}

// The schema's `maxItems` for `landmarks`.
export const MAX_VIEWPOINTS = 50;

// Where the pin picker opens with no viewpoint yet: the map section's
// default centre.
export const DEFAULT_VIEWPOINT_CENTER = { lat: 46.87, lng: -114 };

// Longest name the schema allows.
export const MAX_VIEWPOINT_NAME = 80;

// Longest description the schema allows.
export const MAX_VIEWPOINT_DESCRIPTION = 300;

// Five decimals is about a metre, finer than a click on the map.
export function roundCoord(n: number): number {
  return Math.round(n * 100000) / 100000;
}

function isIcon(value: unknown): value is Icon {
  if (value === null || typeof value !== "object") return false;
  const { source, id } = value as Record<string, unknown>;
  return (source === "library" || source === "media") && typeof id === "string";
}

// One entry with the optional keys present only when set: the icon when
// given, the description trimmed and cut to the schema's cap when it
// has any text left.
export function makeViewpoint(
  base: { name: string; lat: number; lng: number },
  icon?: Icon | null,
  description?: string | null
): Viewpoint {
  const entry: Viewpoint = { name: base.name, lat: base.lat, lng: base.lng };
  if (icon) entry.icon = icon;
  const text = (description ?? "").trim().slice(0, MAX_VIEWPOINT_DESCRIPTION);
  if (text.length > 0) entry.description = text;
  return entry;
}

// The viewpoints of a stored value; entries that are not the stored shape
// are dropped, and an icon or description of another shape is left off
// its entry.
export function toViewpoints(value: unknown): Viewpoint[] {
  if (!Array.isArray(value)) return [];
  const out: Viewpoint[] = [];
  for (const v of value) {
    if (v === null || typeof v !== "object") continue;
    const { name, lat, lng, icon, description } = v as Record<string, unknown>;
    if (typeof name !== "string" || typeof lat !== "number" || typeof lng !== "number") {
      continue;
    }
    const entry: Viewpoint = { name, lat, lng };
    if (isIcon(icon)) entry.icon = icon;
    if (typeof description === "string" && description.length > 0) {
      entry.description = description;
    }
    out.push(entry);
  }
  return out;
}

// Appends an entry; the list is returned unchanged at the cap.
export function addViewpoint(list: readonly Viewpoint[], entry: Viewpoint): Viewpoint[] {
  if (list.length >= MAX_VIEWPOINTS) return list.slice();
  return [...list, entry];
}

export function replaceViewpoint(
  list: readonly Viewpoint[],
  index: number,
  entry: Viewpoint
): Viewpoint[] {
  if (index < 0 || index >= list.length) return list.slice();
  const next = list.slice();
  next[index] = entry;
  return next;
}

export function removeViewpoint(list: readonly Viewpoint[], index: number): Viewpoint[] {
  return list.filter((_, i) => i !== index);
}

export function moveViewpoint(
  list: readonly Viewpoint[],
  from: number,
  to: number
): Viewpoint[] {
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) {
    return list.slice();
  }
  const next = list.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x as Viewpoint);
  return next;
}

// The value written for a list: an empty list removes the key.
export function viewpointsValue(list: readonly Viewpoint[]): Viewpoint[] | undefined {
  return list.length > 0 ? list.slice() : undefined;
}
