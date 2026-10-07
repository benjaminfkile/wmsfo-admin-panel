import { useState } from "react";
import { Stack, TextField, Typography } from "@mui/material";
import ConfirmDialog from "../../components/ConfirmDialog";

interface Props {
  open: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: (label: string | null) => void;
}

// The publish confirmation with its optional label. A blank label confirms
// as null; the field keeps its text while the dialog is open (so a failed
// publish can be retried) and clears once the dialog closes.
export default function PublishLabelDialog({
  open,
  disabled,
  onCancel,
  onConfirm,
}: Props) {
  const [label, setLabel] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setLabel("");
  }

  return (
    <ConfirmDialog
      open={open}
      title="Publish draft"
      body={
        <Stack spacing={2}>
          <Typography variant="body2">
            The public site updates within its next poll.
          </Typography>
          <TextField
            size="small"
            label="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            inputProps={{ maxLength: 100 }}
            helperText="Up to 100 characters"
            autoFocus
            data-testid="publish-label"
          />
        </Stack>
      }
      confirmLabel="Publish"
      onCancel={onCancel}
      onConfirm={() => {
        const trimmed = label.trim();
        onConfirm(trimmed === "" ? null : trimmed);
      }}
      disabled={disabled}
    />
  );
}
