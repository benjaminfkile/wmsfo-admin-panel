import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ErrorAlert from "../../components/ErrorAlert";

export type CreateBeaconBody = {
  name: string;
  notes: string;
};

interface Props {
  open: boolean;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (body: CreateBeaconBody) => void;
}

export default function BeaconCreateDialog({
  open,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setNotes("");
      setErrors({});
    }
  }, [open]);

  const validate = (): CreateBeaconBody | null => {
    const next: Record<string, string> = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 1) next.name = "Name is required";
    else if (trimmedName.length > 100)
      next.name = "Name must be 100 characters or fewer";
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > 2000)
      next.notes = "Notes must be 2000 characters or fewer";
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return { name: trimmedName, notes: trimmedNotes };
  };

  const handleSubmit = () => {
    const body = validate();
    if (body) onSubmit(body);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>New beacon</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? (
            <ErrorAlert
              error={error}
              handledFields={Object.keys(errors)}
            />
          ) : null}
          <Typography variant="body2" color="text.secondary">
            A beacon is a key. Anything that holds it can post locations,
            heartbeats, and logs; what runs behind it is up to you.
          </Typography>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name ?? ""}
            fullWidth
            autoFocus
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            error={!!errors.notes}
            helperText={errors.notes ?? "Optional"}
            fullWidth
            multiline
            rows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
