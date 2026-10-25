import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import type { Event } from "../../api/types";
import type { CloneEventBody } from "../../api/resources/events";
import ErrorAlert from "../../components/ErrorAlert";
import { ApiError } from "../../api/errors";
import { fieldErrorFor } from "../../lib/fieldErrors";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";
import HelpButton from "../../help/HelpButton";
import TrackerAreaField from "../../components/events/TrackerAreaField";
import { findMap, mapArea, type TrackerArea } from "../../components/events/trackerArea";
import {
  MISSOULA_VALLEY_BBOX,
  bboxContains,
  bboxValid,
  toBbox,
} from "../../components/bbox/bbox";
import { maps as mapsApi } from "../../api/resources/maps";
import { keys } from "../../queries/keys";

interface Props {
  open: boolean;
  source: Event | null;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (body: CloneEventBody) => void;
}

// The source's map and box, the map only while it is ready.
function sourceArea(source: Event | null, ready: (id: number) => boolean): TrackerArea {
  const bbox = toBbox(source?.trackerBbox) ?? MISSOULA_VALLEY_BBOX;
  const id = source?.trackerMapId == null ? null : Number(source.trackerMapId);
  return { mapId: id !== null && ready(id) ? id : null, bbox };
}

function defaultName(source: Event | null, sourceYear: number, targetYear: number): string {
  const name = source?.name ?? "";
  if (!name) return "";
  const y = String(sourceYear);
  if (name.includes(y)) return name.split(y).join(String(targetYear));
  return name;
}

export default function EventCloneDialog({
  open,
  source,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [year, setYear] = useState("");
  const [name, setName] = useState("");
  const [sponsors, setSponsors] = useState(true);
  const [tracker, setTracker] = useState(true);
  // The chosen map and box, or null while they follow the source's.
  const [picked, setPicked] = useState<TrackerArea | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mapsQ = useQuery({
    queryKey: keys.maps,
    queryFn: () => mapsApi.list(),
    enabled: open,
  });
  const area =
    picked ??
    // Until the maps load, the source's map stands.
    sourceArea(
      source,
      (id) => mapsQ.data === undefined || findMap(mapsQ.data.items, id)?.state === "ready"
    );
  const outer = mapArea(findMap(mapsQ.data?.items, area.mapId));
  const boxOk = bboxValid(area.bbox) && (outer === null || bboxContains(outer, area.bbox));

  useEffect(() => {
    if (!open || !source) return;
    const sourceYear = Number(source.year);
    const targetYear = sourceYear + 1;
    setYear(String(targetYear));
    setName(defaultName(source, sourceYear, targetYear));
    setSponsors(true);
    setTracker(true);
    setPicked(null);
    setErrors({});
  }, [open, source]);

  const serverYearError =
    fieldErrorFor(error, "year") ??
    (error instanceof ApiError && error.code === "year_taken"
      ? "That year is already taken"
      : null);

  const validate = (): { ok: boolean; body?: CloneEventBody } => {
    const next: Record<string, string> = {};
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      next.year = "Year must be between 2000 and 2100";
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 1) next.name = "Name is required";
    else if (trimmedName.length > 200)
      next.name = "Name must be 200 characters or fewer";
    if (!boxOk) next.trackerBbox = "Fix the tracker area";
    setErrors(next);
    if (Object.keys(next).length > 0) return { ok: false };
    return {
      ok: true,
      body: {
        year: y,
        name: trimmedName,
        copy: { sponsors, tracker },
        trackerMapId: area.mapId,
        trackerBbox: area.bbox,
      },
    };
  };

  const handleSubmit = () => {
    const r = validate();
    if (r.ok && r.body) onSubmit(r.body);
  };

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitleWithHelp help="events.clone">Clone event</DialogTitleWithHelp>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {source ? (
            <Typography variant="body2" color="text.secondary">
              Cloning {source.name}.
            </Typography>
          ) : null}
          {error ? (
            <ErrorAlert
              error={error}
              handledFields={[...Object.keys(errors), "year", "trackerBbox", "trackerMapId"]}
            />
          ) : null}
          <TextField
            label="Year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            error={!!(errors.year ?? serverYearError)}
            helperText={errors.year ?? serverYearError ?? ""}
            fullWidth
            inputProps={{ min: 2000, max: 2100 }}
          />
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name ?? ""}
            fullWidth
          />
          <TrackerAreaField
            value={area}
            onChange={setPicked}
            exportName={name.trim() || "New event"}
            bboxError={fieldErrorFor(error, "trackerBbox")}
            mapError={fieldErrorFor(error, "trackerMapId")}
          />
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={sponsors}
                  onChange={(_, v) => setSponsors(v)}
                />
              }
              label="Sponsors for the year"
            />
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={tracker}
                    onChange={(_, v) => setTracker(v)}
                  />
                }
                label="Tracker themes"
              />
              <HelpButton topic="events.clone.tracker" />
            </Stack>
            <FormHelperText sx={{ mt: 0, ml: 4 }}>
              The map and the area are chosen above.
            </FormHelperText>
          </FormGroup>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !boxOk}
        >
          Clone
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
