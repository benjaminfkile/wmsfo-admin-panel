import { useCallback } from "react";
import { Box, TextField, Typography } from "@mui/material";
import type { FieldProps } from "@rjsf/utils";

// A text area for the `Inline` primitive. The full spec includes a
// toolbar and preview; those are UI concerns of this component while
// the value on the wire stays a plain string.
export default function InlineField(props: FieldProps) {
  const value = typeof props.formData === "string" ? props.formData : "";
  const oneOf = (props.schema as { oneOf?: unknown[] }).oneOf;
  const nullable = Array.isArray(oneOf);
  const max =
    typeof (props.schema as { maxLength?: number }).maxLength === "number"
      ? (props.schema as { maxLength: number }).maxLength
      : 5000;

  const onChange = useCallback(
    (next: string) => {
      if (next === "" && nullable) {
        props.onChange(null, props.fieldPathId.path);
      } else {
        props.onChange(next, props.fieldPathId.path);
      }
    },
    [nullable, props]
  );

  const label =
    typeof props.schema.title === "string" ? props.schema.title : props.name;

  return (
    <Box sx={{ my: 1 }} data-testid="inline-field">
      <TextField
        label={label ?? ""}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => props.onBlur(props.fieldPathId.$id, value)}
        fullWidth
        multiline
        minRows={2}
        inputProps={{ maxLength: max }}
      />
      <Typography variant="caption" color="text.secondary">
        {value.length} / {max}
      </Typography>
    </Box>
  );
}
