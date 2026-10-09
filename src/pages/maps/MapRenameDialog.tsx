import { useState } from "react";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import ErrorAlert from "../../components/ErrorAlert";

interface Props {
  name: string;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

// One Name field, 1 to 200 characters (admin.md 6.27). The caller mounts
// it only while open, so each open starts from the saved name.
export default function MapRenameDialog({
  name: saved,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(saved);
  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 200;
  return (
    <AppDialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Rename map</DialogTitle>
      <DialogContent>
        {error ? <ErrorAlert error={error} /> : null}
        <TextField
          autoFocus
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid && !submitting) onSubmit(trimmed);
          }}
          error={trimmed.length === 0}
          helperText={trimmed.length === 0 ? "Required" : undefined}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          fullWidth
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid || submitting}
          onClick={() => onSubmit(trimmed)}
        >
          Save
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
