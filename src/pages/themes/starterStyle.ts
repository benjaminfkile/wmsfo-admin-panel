import type { StyleSpecification } from "maplibre-gl";
import routeLight from "../../../contracts/fixtures/themes/route-light.json";
import type { Config } from "../../config";
import { downloadBlob } from "../../lib/download";
import { forMaputnik } from "../../routeMap";

// The starter style (admin.md 6.28): the vendored `route-light` seed,
// with sources named `basemap` and `terrain` and its places layer
// marked, for a Maputnik edit and an import back as a theme.
export const starterStyle: unknown = routeLight;

export const STARTER_STYLE_FILENAME = "starter-style.json";

// Serves a style document as `<filename>` in JSON.
export function downloadStyle(style: unknown, filename: string): void {
  downloadBlob(
    new Blob([JSON.stringify(style, null, 2)], {
      type: "application/json",
    }),
    filename
  );
}

// Serves the seed through `forMaputnik`, so it opens in Maputnik with the
// glyphs and the tiles of the configured basemap.
export function downloadStarterStyle(config: Pick<Config, "routeBasemapUrl">): void {
  downloadStyle(
    forMaputnik(starterStyle as StyleSpecification, config),
    STARTER_STYLE_FILENAME
  );
}
