// The route_preview and site settings schemas with the route map groups
// the SchemaForm fields LandmarksField, PoisField, RouteMapDisplayField,
// and RouteMapOverrideField draw: route_preview gains `controls`,
// `landmarks`, `display`, and `pois`, and site settings gains `routeMap`,
// each the matching block of RouteMapConfig in primitives.schema.json.
// The contract carries these groups on the event's `routeMapConfig`
// only; the tests of those fields render them through these schemas.

import primitives from "../../contracts/schema/primitives.schema.json";
import routePreview from "../../contracts/schema/sections/route_preview.schema.json";
import siteSettings from "../../contracts/schema/site-settings.schema.json";

type Sch = Record<string, unknown>;

const ICON_REF = "https://wmsfo.dev/schema/primitives.schema.json#/$defs/Icon";

const config = (primitives as { $defs: { RouteMapConfig: { properties: Record<string, Sch> } } })
  .$defs.RouteMapConfig.properties;

// A deep copy with the primitives-local Icon reference made absolute, so
// the block resolves from another schema document.
function absolute(block: Sch | undefined): Sch {
  return JSON.parse(
    JSON.stringify(block ?? {}).split('"#/$defs/Icon"').join(JSON.stringify(ICON_REF))
  ) as Sch;
}

export const routeMapConfigBlocks = {
  display: absolute(config.display),
  controls: absolute(config.controls),
  landmarks: absolute(config.landmarks),
  pois: absolute(config.pois),
};

export const routePreviewWithGroups: Sch = {
  ...routePreview,
  properties: {
    ...routePreview.properties,
    controls: routeMapConfigBlocks.controls,
    landmarks: routeMapConfigBlocks.landmarks,
    display: routeMapConfigBlocks.display,
    pois: routeMapConfigBlocks.pois,
  },
};

export const siteSettingsWithRouteMap: Sch = {
  ...siteSettings,
  properties: {
    ...siteSettings.properties,
    routeMap: routeMapConfigBlocks.display,
  },
};
