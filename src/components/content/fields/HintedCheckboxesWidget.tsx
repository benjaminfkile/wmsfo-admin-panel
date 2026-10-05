import { FormHelperText, Stack } from "@mui/material";
import type { WidgetProps } from "@rjsf/utils";

// The MUI checkbox group (an array of enum values, one box per value)
// with `ui:options.hint` rendered as a short line under the boxes, the
// way `DefaultedSwitchWidget` shows its hint. A `when` rule in labels.ts
// sets the hint while the group is disabled (the map's `poiKinds` while
// its filter is off). Registered as `checkboxes`, so it replaces the
// default group in every SchemaForm; the theme's own group is reached
// through the registry under its full name.
export default function HintedCheckboxesWidget(props: WidgetProps) {
  const Base = props.registry.widgets.CheckboxesWidget;
  if (Base === undefined) return null;
  const hint = typeof props.options.hint === "string" ? props.options.hint : "";
  return (
    <Stack spacing={0.5} data-testid={`checkboxes-${props.id}`}>
      <Base {...props} />
      {hint ? <FormHelperText sx={{ mt: 0 }}>{hint}</FormHelperText> : null}
    </Stack>
  );
}
