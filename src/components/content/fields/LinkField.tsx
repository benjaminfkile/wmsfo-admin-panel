import { useState } from "react";
import {
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import type { Icon } from "../../../api/types";
import IconPicker from "../pickers/IconPicker";

type LinkValue = {
  label: string;
  href: string;
  icon: Icon | null;
  newTab: boolean;
};

const EMPTY: LinkValue = { label: "", href: "", icon: null, newTab: false };

// The `Link` primitive. Label (inline), href, icon, and newTab.
export default function LinkField(props: FieldProps) {
  const value = (props.formData as Partial<LinkValue> | undefined) ?? EMPTY;
  const [iconOpen, setIconOpen] = useState(false);

  const label =
    typeof props.schema.title === "string" ? props.schema.title : props.name;

  const patch = (partial: Partial<LinkValue>) => {
    props.onChange(
      {
        label: value.label ?? "",
        href: value.href ?? "",
        icon: value.icon ?? null,
        newTab: value.newTab ?? false,
        ...partial,
      } as unknown,
      props.fieldPathId.path
    );
  };

  return (
    <Box sx={{ my: 1 }} data-testid="link-field">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack spacing={1}>
        <TextField
          size="small"
          label="Label"
          value={value.label ?? ""}
          onChange={(e) => patch({ label: e.target.value })}
          fullWidth
        />
        <TextField
          size="small"
          label="Href"
          value={value.href ?? ""}
          onChange={(e) => patch({ href: e.target.value })}
          onBlur={() => props.onBlur(props.fieldPathId.$id, value)}
          fullWidth
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">
            Icon:{" "}
            {value.icon
              ? value.icon.source === "library"
                ? `Library: ${value.icon.id}`
                : `Media: ${String(value.icon.id).slice(0, 8)}…`
              : "none"}
          </Typography>
          <button
            type="button"
            onClick={() => setIconOpen(true)}
            style={{ padding: 4 }}
          >
            Choose icon
          </button>
          {value.icon ? (
            <button
              type="button"
              onClick={() => patch({ icon: null })}
              style={{ padding: 4 }}
            >
              Clear
            </button>
          ) : null}
        </Stack>
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(value.newTab)}
              onChange={(e) => patch({ newTab: e.target.checked })}
            />
          }
          label="Open in new tab"
        />
      </Stack>
      <IconPicker
        open={iconOpen}
        onCancel={() => setIconOpen(false)}
        onPick={(icon) => {
          setIconOpen(false);
          patch({ icon });
        }}
      />
    </Box>
  );
}
