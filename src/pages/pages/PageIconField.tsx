import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import IconPicker from "../../components/content/pickers/IconPicker";
import IconPreview from "../../components/content/IconPreview";
import { PAGE_SETTINGS_LABELS } from "../../components/content/labels";
import type { Icon } from "../../api/types";

interface Props {
  value: Icon | null;
  onChange: (next: Icon | null) => void;
}

// The page's optional Menu icon in the create and settings dialogs:
// the picked icon's preview (or "None"), Choose opening the shared icon
// picker, and Clear while one is set. A new pick keeps the current
// icon's `display`. Label and help come from PAGE_SETTINGS_LABELS.
export default function PageIconField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const entry = PAGE_SETTINGS_LABELS.icon;

  return (
    <Box data-testid="page-icon-field">
      <Typography variant="caption" color="text.secondary">
        {entry?.label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {value ? (
          <IconPreview icon={value} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            None
          </Typography>
        )}
        <Button size="small" onClick={() => setOpen(true)}>
          Choose
        </Button>
        {value ? (
          <Button size="small" color="error" onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : null}
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        data-testid="page-icon-help"
      >
        {entry?.help}
      </Typography>
      <IconPicker
        open={open}
        title="Choose menu icon"
        onCancel={() => setOpen(false)}
        onPick={(next) => {
          setOpen(false);
          onChange(value?.display ? { ...next, display: value.display } : next);
        }}
      />
    </Box>
  );
}
