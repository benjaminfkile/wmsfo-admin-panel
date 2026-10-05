import { useMemo, useState } from "react";
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AppDialog from "../../AppDialog";
import IconControl from "../blocks/IconControl";
import ViewpointPicker, { type LatLng } from "./ViewpointPicker";
import {
  MAX_VIEWPOINT_DESCRIPTION,
  MAX_VIEWPOINT_NAME,
  makeViewpoint,
  roundCoord,
  type Viewpoint,
} from "../viewpoints";
import type { Icon } from "../../../api/types";

interface Props {
  // The entry being edited, or null to add one.
  initial: Viewpoint | null;
  // Where the map opens when the entry has no pin yet.
  center: LatLng;
  onCancel: () => void;
  onSave: (entry: Viewpoint) => void;
}

function parseCoord(text: string, limit: number): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}

// Adds or edits one viewpoint: a map where a click places the pin, the
// Latitude and Longitude fields the pin fills (and that move it when
// typed into), the Name, the optional Icon (the shared icon picker,
// clearable), and the optional Description with its live count. Save is
// enabled once there is a name and a pin, and writes the name trimmed
// with the point rounded to five decimals; the icon and the trimmed
// description are written only when set.
export default function ViewpointDialog({ initial, center, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [latText, setLatText] = useState(initial ? String(initial.lat) : "");
  const [lngText, setLngText] = useState(initial ? String(initial.lng) : "");
  const [icon, setIcon] = useState<Icon | null>(initial?.icon ?? null);
  const [description, setDescription] = useState(initial?.description ?? "");

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
      <DialogTitle>{initial ? "Edit viewpoint" : "Add viewpoint"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Click the map where the viewpoint is, then name it.
          </Typography>
          <ViewpointPicker value={pin} center={initial ?? center} onPick={onPick} />
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
            onChange={(e) => setName(e.target.value.slice(0, MAX_VIEWPOINT_NAME))}
            helperText="Shown beside the dot on the route map"
            autoFocus
            fullWidth
          />
          <IconControl
            label="Icon"
            value={icon}
            onChange={setIcon}
            testId="viewpoint-icon"
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) =>
              setDescription(e.target.value.slice(0, MAX_VIEWPOINT_DESCRIPTION))
            }
            helperText={
              <Box
                component="span"
                sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}
              >
                <span>The site shows this when a visitor taps the viewpoint.</span>
                <span data-testid="viewpoint-description-count">
                  {description.length} / {MAX_VIEWPOINT_DESCRIPTION}
                </span>
              </Box>
            }
            multiline
            minRows={2}
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
            onSave(
              makeViewpoint(
                { name: trimmed, lat: roundCoord(pin.lat), lng: roundCoord(pin.lng) },
                icon,
                description
              )
            );
          }}
        >
          Save
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
