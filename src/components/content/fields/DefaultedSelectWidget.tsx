import { MenuItem, TextField } from "@mui/material";
import type { WidgetProps } from "@rjsf/utils";

// An enum select for a field whose absent or null value means a default
// (labels.ts `unset`, e.g. the hero's icon size reads "Small" when
// unset). The unset state shows that default's label instead of a blank
// box and writes nothing until an option is picked.
export default function DefaultedSelectWidget(props: WidgetProps) {
  const { id, label, value, options, disabled, readonly, onChange, onBlur, onFocus } =
    props;
  const unsetLabel =
    typeof options.unsetLabel === "string" ? options.unsetLabel : "";
  const enumOptions = (options.enumOptions ?? []).filter(
    (o) => o.value !== null && o.value !== undefined
  );
  const current = value === null || value === undefined ? "" : String(value);

  return (
    <TextField
      id={id}
      select
      fullWidth
      label={label}
      value={current}
      disabled={disabled || readonly}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
      slotProps={{
        inputLabel: { shrink: true },
        select: {
          displayEmpty: true,
          renderValue: (v) =>
            v === ""
              ? unsetLabel
              : (enumOptions.find((o) => String(o.value) === v)?.label ??
                String(v)),
        },
      }}
    >
      {enumOptions.map((o) => (
        <MenuItem key={String(o.value)} value={String(o.value)}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
