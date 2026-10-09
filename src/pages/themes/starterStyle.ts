import routeLight from "../../../contracts/fixtures/themes/route-light.json";
import { downloadBlob } from "../../lib/download";

// The starter style (admin.md 6.28): the vendored `route-light` seed,
// with sources named `basemap` and `terrain` and its places layer
// marked, for a Maputnik edit and an import back as a theme.
export const starterStyle: unknown = routeLight;

export const STARTER_STYLE_FILENAME = "starter-style.json";

export function downloadStarterStyle(): void {
  downloadBlob(
    new Blob([JSON.stringify(starterStyle, null, 2)], {
      type: "application/json",
    }),
    STARTER_STYLE_FILENAME
  );
}
