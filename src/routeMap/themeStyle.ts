// A tracker theme's MapLibre style body (admin.md 2.11, 6.28) and the one
// rule that points it at a tracker map. The body's `glyphs` and `sprite`
// are the API's and pass through untouched.

import type {
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { TrackerMap } from "../api/types";
import { keys } from "../queries/keys";

export const BASEMAP_SOURCE = "basemap";
export const TERRAIN_SOURCE_ID = "terrain";
export const PLACES_METADATA = "wmsfo:places";

// Fetches a theme's style body. The URL names an immutable object
// (`<cdn>/themes/<sha>.json`), so the query never goes stale.
export async function loadThemeStyle(url: string): Promise<StyleSpecification> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The theme style could not load (${res.status}).`);
  return (await res.json()) as StyleSpecification;
}

export function themeStyleQuery(url: string) {
  return {
    queryKey: keys.themeStyle(url),
    queryFn: () => loadThemeStyle(url),
    staleTime: Infinity,
  };
}

// Whether a layer carries the places marker in its metadata.
export function isPlacesLayer(layer: LayerSpecification): boolean {
  const meta = (layer as { metadata?: unknown }).metadata;
  return (
    meta !== null &&
    typeof meta === "object" &&
    (meta as Record<string, unknown>)[PLACES_METADATA] === true
  );
}

function layerSource(layer: LayerSpecification): string | undefined {
  return (layer as { source?: unknown }).source as string | undefined;
}

// A copy of the style with the `basemap` source at `tilesUrl` and the
// `terrain` source at `terrainUrl`, or, with `terrainUrl` null, without
// the `terrain` source and every layer drawing from it.
export function withSources(
  style: StyleSpecification,
  tilesUrl: string,
  terrainUrl: string | null,
): StyleSpecification {
  const sources: StyleSpecification["sources"] = {};
  for (const [id, source] of Object.entries(style.sources)) {
    if (id === BASEMAP_SOURCE) {
      sources[id] = { ...source, url: `pmtiles://${tilesUrl}` } as typeof source;
    } else if (id === TERRAIN_SOURCE_ID) {
      if (terrainUrl !== null) {
        sources[id] = { ...source, url: `pmtiles://${terrainUrl}` } as typeof source;
      }
    } else {
      sources[id] = source;
    }
  }
  const layers =
    terrainUrl === null
      ? style.layers.filter((l) => layerSource(l) !== TERRAIN_SOURCE_ID)
      : style.layers;
  return { ...style, sources, layers };
}

// The places layers kept to the given kinds (each layer's own filter
// joined with a `kind` test), or hidden for an empty list. Without kinds
// the layers stay as the theme draws them.
function withPlaceKinds(
  layers: LayerSpecification[],
  poiKinds: readonly string[] | undefined,
): LayerSpecification[] {
  if (poiKinds === undefined) return layers;
  return layers.map((layer) => {
    if (!isPlacesLayer(layer)) return layer;
    if (poiKinds.length === 0) {
      return {
        ...layer,
        layout: { ...(layer as { layout?: object }).layout, visibility: "none" },
      } as LayerSpecification;
    }
    const kindTest = ["in", ["get", "kind"], ["literal", [...poiKinds]]];
    const own = (layer as { filter?: FilterSpecification }).filter;
    const filter = (own === undefined ? kindTest : ["all", own, kindTest]) as FilterSpecification;
    return { ...layer, filter } as LayerSpecification;
  });
}

export type ApplyMapOptions = {
  terrain: boolean;
  poiKinds?: readonly string[];
};

// The theme body drawn over a tracker map row: `basemap` at the row's
// `<cdn>/<prefix>/tiles.pmtiles`, `terrain` at its `terrain.pmtiles`
// (dropped with its layers when the map has no terrain file or `terrain`
// is false), and the places layers kept to `poiKinds`.
export function applyMap(
  style: StyleSpecification,
  map: Pick<TrackerMap, "tilesUrl" | "terrainUrl">,
  { terrain, poiKinds }: ApplyMapOptions,
): StyleSpecification {
  const terrainUrl = terrain && map.terrainUrl ? map.terrainUrl : null;
  const pointed = withSources(style, map.tilesUrl ?? "", terrainUrl);
  return { ...pointed, layers: withPlaceKinds(pointed.layers, poiKinds) };
}
