import { Box, Typography } from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import {
  POI_CATEGORIES,
  TRACKER_KINDS,
  placesPart,
  withPlacesPart,
  type PlacesPart,
  type PoisValue,
} from "../places";
import PoisEditor from "./PoisEditor";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// Site settings `places`: the places each map labels, as two PoisEditor
// groups. Live tracker (`places.tracker`) offers the nine Google kinds;
// Route map (`places.routeMap`) offers the OpenStreetMap categories. The
// title and help come from the uiSchema (the labels table).
export default function PlacesField(props: FieldProps) {
  const ui = props.uiSchema;
  const help = uiString(ui, "ui:description");
  const disabled = props.disabled || props.readonly;
  const write = (part: PlacesPart, next: PoisValue | undefined) =>
    props.onChange(withPlacesPart(props.formData, part, next), props.fieldPathId.path);

  return (
    <Box sx={{ my: 1, minWidth: 0 }} data-testid="places-field">
      <Typography variant="subtitle1">{uiString(ui, "ui:title") ?? "Places on the maps"}</Typography>
      {help ? (
        <Typography variant="caption" color="text.secondary" component="p">
          {help}
        </Typography>
      ) : null}
      <PoisEditor
        value={placesPart(props.formData, "tracker")}
        onChange={(next) => write("tracker", next)}
        title="Live tracker"
        help="Default shows the places the map style draws. Custom shows only the kinds you check."
        categories={TRACKER_KINDS}
        testId="places-tracker"
        disabled={disabled}
      />
      <PoisEditor
        value={placesPart(props.formData, "routeMap")}
        onChange={(next) => write("routeMap", next)}
        title="Route map"
        help="Default shows no places. Custom labels only the kinds of places you check."
        categories={POI_CATEGORIES}
        testId="places-route-map"
        disabled={disabled}
      />
    </Box>
  );
}
