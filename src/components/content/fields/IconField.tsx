import { useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import IconPicker from "../pickers/IconPicker";
import type { Icon } from "../../../api/types";

// The `Icon` primitive. The current icon shows as a chip; a Choose
// button opens the library and svg-media picker; a Clear button removes
// it (allowed when the schema is nullable).
export default function IconField(props: FieldProps) {
  const value = (props.formData as Icon | null | undefined) ?? null;
  const oneOf = (props.schema as { oneOf?: unknown[] }).oneOf;
  const nullable = Array.isArray(oneOf);
  const [open, setOpen] = useState(false);

  const label =
    typeof props.schema.title === "string" ? props.schema.title : props.name;

  return (
    <Box sx={{ my: 1 }} data-testid="icon-field">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        {value ? (
          <Chip
            label={
              value.source === "library"
                ? `Library: ${value.id}`
                : `Media: ${String(value.id).slice(0, 8)}…`
            }
            variant="outlined"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            None
          </Typography>
        )}
        <Button size="small" onClick={() => setOpen(true)}>
          Choose
        </Button>
        {value && nullable ? (
          <Button
            size="small"
            color="error"
            onClick={() => props.onChange(null, props.fieldPathId.path)}
          >
            Clear
          </Button>
        ) : null}
      </Stack>
      <IconPicker
        open={open}
        onCancel={() => setOpen(false)}
        onPick={(next) => {
          setOpen(false);
          props.onChange(next as unknown, props.fieldPathId.path);
        }}
      />
    </Box>
  );
}
