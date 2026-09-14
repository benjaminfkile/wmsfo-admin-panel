import { useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import ErrorAlert from "../../components/ErrorAlert";
import type { Place } from "../../api/types";

interface Props {
  open: boolean;
  places: Place[];
  onCancel: () => void;
  onSubmit: (placeId: number) => void;
  submitting?: boolean;
  error?: unknown;
  title?: string;
}

type Option = { placeId: number; label: string };

// The places typeahead: label is the flattened path, so a caller can
// find "Southgate Mall › West wing" without knowing an id.
function optionsFrom(places: Place[]): Option[] {
  return places.map((p) => ({
    placeId: p.id,
    label: p.path.join(" › "),
  }));
}

export default function AttachDialog({
  open,
  places,
  onCancel,
  onSubmit,
  submitting = false,
  error,
  title = "Attach to a place",
}: Props) {
  const options = useMemo(() => optionsFrom(places), [places]);
  const [selected, setSelected] = useState<Option | null>(null);

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {error ? <ErrorAlert error={error} /> : null}
        <Autocomplete
          options={options}
          value={selected}
          onChange={(_, v) => setSelected(v)}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(a, b) => a.placeId === b.placeId}
          renderInput={(params) => (
            <TextField {...params} label="Place" placeholder="Type to filter" />
          )}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!selected || submitting}
          onClick={() => selected && onSubmit(selected.placeId)}
        >
          Attach
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
