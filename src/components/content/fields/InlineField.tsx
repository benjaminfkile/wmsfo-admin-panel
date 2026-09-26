import { useCallback } from "react";
import { Box } from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import InlineText from "../InlineText";

// The `Inline` primitive. `InlineText` supplies the toolbar and the
// preview; the value on the wire stays a plain string, and an empty
// value on a nullable schema is sent as null.
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
      <InlineText
        value={value}
        onChange={onChange}
        label={label ?? ""}
        maxLength={max}
        multiline
        minRows={2}
        onBlur={() => props.onBlur(props.fieldPathId.$id, value)}
      />
    </Box>
  );
}
