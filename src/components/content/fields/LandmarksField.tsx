import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type { FieldProps } from "@rjsf/utils";
import LandmarkDialog from "./LandmarkDialog";
import type { LatLng } from "./LandmarkPicker";
import {
  DEFAULT_LANDMARK_CENTER,
  MAX_LANDMARKS,
  addLandmark,
  landmarksValue,
  moveLandmark,
  removeLandmark,
  replaceLandmark,
  toLandmarks,
  type Landmark,
} from "../landmarks";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function formatPoint({ lat, lng }: Landmark): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// The route_preview `landmarks` list: one row per entry with its name and
// point, up and down, edit, and delete; "Add landmark" opens the pin
// picker dialog. The count shows against the cap and Add is disabled at
// it. An empty list removes the key.
export default function LandmarksField(props: FieldProps) {
  const list = toLandmarks(props.formData);
  const title = uiString(props.uiSchema, "ui:title") ?? "Landmarks";
  const help = uiString(props.uiSchema, "ui:description");
  const disabled = Boolean(props.disabled || props.readonly);
  // The index being edited, "new" for Add, or null when closed.
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const write = (next: Landmark[]) => {
    props.onChange(landmarksValue(next), props.fieldPathId.path);
  };

  const full = list.length >= MAX_LANDMARKS;
  const last = list[list.length - 1];
  const center: LatLng = last ? { lat: last.lat, lng: last.lng } : DEFAULT_LANDMARK_CENTER;

  return (
    <Box sx={{ my: 1, minWidth: 0 }} data-testid="landmarks-field">
      <Typography variant="subtitle2">{title}</Typography>
      {help ? (
        <Typography variant="caption" color="text.secondary" component="p">
          {help}
        </Typography>
      ) : null}
      <Stack spacing={1} sx={{ mt: 1 }} data-testid="landmarks-list">
        {list.map((entry, i) => (
          <Paper
            key={`${i}-${entry.name}`}
            variant="outlined"
            sx={{ px: 1.5, py: 1 }}
            data-testid={`landmark-${i}`}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {entry.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatPoint(entry)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label={`Move ${entry.name} up`}
                disabled={disabled || i === 0}
                onClick={() => write(moveLandmark(list, i, i - 1))}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Move ${entry.name} down`}
                disabled={disabled || i === list.length - 1}
                onClick={() => write(moveLandmark(list, i, i + 1))}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Edit ${entry.name}`}
                disabled={disabled}
                onClick={() => setEditing(i)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Delete ${entry.name}`}
                disabled={disabled}
                onClick={() => write(removeLandmark(list, i))}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
        <Tooltip title={full ? `Up to ${MAX_LANDMARKS} landmarks` : ""}>
          <span>
            <Button
              size="small"
              startIcon={<AddIcon />}
              disabled={disabled || full}
              onClick={() => setEditing("new")}
            >
              Add landmark
            </Button>
          </span>
        </Tooltip>
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid="landmarks-count"
        >
          {list.length} of {MAX_LANDMARKS}
        </Typography>
      </Stack>
      {editing !== null ? (
        <LandmarkDialog
          initial={editing === "new" ? null : (list[editing] ?? null)}
          center={center}
          onCancel={() => setEditing(null)}
          onSave={(entry) => {
            write(
              editing === "new"
                ? addLandmark(list, entry)
                : replaceLandmark(list, editing, entry)
            );
            setEditing(null);
          }}
        />
      ) : null}
    </Box>
  );
}
