import { useMemo, useState } from "react";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AppDialog from "../../AppDialog";
import LandmarkPicker, { type LatLng } from "./LandmarkPicker";
import { MAX_LANDMARK_NAME, roundCoord, type Landmark } from "../landmarks";

interface Props {
  // The entry being edited, or null to add one.
  initial: Landmark | null;
  // Where the map opens when the entry has no pin yet.
  center: LatLng;
  onCancel: () => void;
  onSave: (entry: Landmark) => void;
}

function parseCoord(text: string, limit: number): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}

// Adds or edits one landmark: a map where a click places the pin, the
// Latitude and Longitude fields the pin fills (and that move it when
// typed into), and the Name. Save is enabled once there is a name and a
// pin, and writes the name trimmed with the point rounded to five
// decimals.
export default function LandmarkDialog({ initial, center, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [latText, setLatText] = useState(initial ? String(initial.lat) : "");
  const [lngText, setLngText] = useState(initial ? String(initial.lng) : "");

  const lat = parseCoord(latText, 90);
  const lng = parseCoord(lngText, 180);
  const pin = useMemo(
    () => (lat !== null && lng !== null ? { lat, lng } : null),
    [lat, lng]
  );
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && pin !== null;

  const onPick = (p: LatLng) => {
    setLatText(String(p.lat));
    setLngText(String(p.lng));
  };

  return (
    <AppDialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? "Edit landmark" : "Add landmark"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Click the map where the landmark is, then name it.
          </Typography>
          <LandmarkPicker value={pin} center={initial ?? center} onPick={onPick} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Latitude"
              value={latText}
              onChange={(e) => setLatText(e.target.value)}
              error={latText.trim() !== "" && lat === null}
              inputMode="decimal"
              fullWidth
            />
            <TextField
              label="Longitude"
              value={lngText}
              onChange={(e) => setLngText(e.target.value)}
              error={lngText.trim() !== "" && lng === null}
              inputMode="decimal"
              fullWidth
            />
          </Stack>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_LANDMARK_NAME))}
            helperText="Shown beside the dot on the route map"
            autoFocus
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={() => {
            if (!pin) return;
            onSave({ name: trimmed, lat: roundCoord(pin.lat), lng: roundCoord(pin.lng) });
          }}
        >
          Save
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
