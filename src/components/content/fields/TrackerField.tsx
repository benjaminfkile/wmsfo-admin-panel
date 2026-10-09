import { Box, Typography } from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import BboxEditor from "../../bbox/BboxEditor";
import { siteDefaultBbox } from "../../bbox/bbox";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// Site settings `tracker`: the box a new event starts with, edited by
// BboxEditor over `defaultBbox` and written as `{ defaultBbox }`. A draft
// without the key shows the Missoula valley box. The title and help come
// from the uiSchema (the labels table).
export default function TrackerField(props: FieldProps) {
  const ui = props.uiSchema;
  const help = uiString(ui, "ui:description");
  const value = siteDefaultBbox({ tracker: props.formData });
  return (
    <Box sx={{ my: 1, minWidth: 0 }} data-testid="tracker-field">
      <Typography variant="subtitle1">{uiString(ui, "ui:title") ?? "Tracker"}</Typography>
      {help ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
          {help}
        </Typography>
      ) : null}
      <BboxEditor
        value={value}
        onChange={(next) => props.onChange({ defaultBbox: next }, props.fieldPathId.path)}
        exportName="Site default"
      />
    </Box>
  );
}
