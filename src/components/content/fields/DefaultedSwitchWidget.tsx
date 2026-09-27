import { FormControlLabel, FormHelperText, Stack, Switch, Typography } from "@mui/material";
import type { WidgetProps } from "@rjsf/utils";

// A switch for a boolean field whose absent or null value means a
// default (labels.ts `switchDefault`, e.g. the header shows the site
// name when unset). The unset state shows the default and writes
// nothing until the switch is flipped. `ui:options.hint` renders a
// short line under the switch (used for "Set a site logo first").
export default function DefaultedSwitchWidget(props: WidgetProps) {
  const { id, label, value, options, disabled, readonly, onChange, onBlur, onFocus } =
    props;
  const fallback = options.switchDefault === true;
  const checked = value === null || value === undefined ? fallback : Boolean(value);
  const hint = typeof options.hint === "string" ? options.hint : "";

  return (
    <Stack spacing={0.5} data-testid={`switch-${id}`}>
      <FormControlLabel
        control={
          <Switch
            id={id}
            checked={checked}
            disabled={disabled || readonly}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={() => onBlur(id, value)}
            onFocus={() => onFocus(id, value)}
            slotProps={{ input: { "aria-label": label } }}
          />
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
      {hint ? <FormHelperText sx={{ mt: 0 }}>{hint}</FormHelperText> : null}
    </Stack>
  );
}
