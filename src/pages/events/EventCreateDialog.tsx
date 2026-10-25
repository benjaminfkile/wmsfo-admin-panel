import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import AppDialog from "../../components/AppDialog";
import type { Event } from "../../api/types";
import type { CreateEventBody } from "../../api/resources/events";
import ErrorAlert from "../../components/ErrorAlert";
import TimeZoneSelect from "../../components/TimeZoneSelect";
import { browserTimeZone, formatStamp, shiftWallZone, wallTimeToUtc } from "../../lib/time";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";
import TrackerAreaField from "../../components/events/TrackerAreaField";
import StartViewField from "../../components/events/StartViewField";
import { startViewInside, type StartView } from "../../components/events/startView";
import { findMap, mapArea, type TrackerArea } from "../../components/events/trackerArea";
import { bboxContains, bboxValid, siteDefaultBbox } from "../../components/bbox/bbox";
import { siteSettings as siteSettingsApi } from "../../api/resources/siteSettings";
import { maps as mapsApi } from "../../api/resources/maps";
import { themes as themesApi } from "../../api/resources/themes";
import { keys } from "../../queries/keys";
import { fieldErrorFor } from "../../lib/fieldErrors";
import { initialCreateArea, trackerPreviewLine } from "./trackerPreview";

interface Props {
  open: boolean;
  events: Event[];
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (body: CreateEventBody) => void;
}

export default function EventCreateDialog({
  open,
  events,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [year, setYear] = useState("");
  const [name, setName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [timeZone, setTimeZone] = useState(browserTimeZone);
  const [fundsPercent, setFundsPercent] = useState("0");
  // The chosen map and box, or null while they follow the map the API
  // would inherit and the site setting.
  const [picked, setPicked] = useState<TrackerArea | null>(null);
  // None until the admin sets one: a new event opens on the whole area.
  const [startView, setStartView] = useState<StartView | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const settingsQ = useQuery({
    queryKey: keys.siteSettings,
    queryFn: () => siteSettingsApi.get(),
    enabled: open,
  });
  const mapsQ = useQuery({
    queryKey: keys.maps,
    queryFn: () => mapsApi.list(),
    enabled: open,
  });
  const themesQ = useQuery({
    queryKey: keys.themes,
    queryFn: () => themesApi.list(),
    enabled: open,
  });
  const siteBox = siteDefaultBbox(settingsQ.data?.data);
  const area = picked ?? initialCreateArea(events, mapsQ.data?.items, siteBox);
  const box = area.bbox;
  const chosenMap = findMap(mapsQ.data?.items, area.mapId);
  const outer = mapArea(chosenMap);
  const boxOk = bboxValid(box) && (outer === null || bboxContains(outer, box));
  const trackerLine = trackerPreviewLine(
    events,
    themesQ.data?.items ?? [],
    chosenMap,
    startView
  );

  useEffect(() => {
    if (open) {
      setYear(String(new Date().getFullYear()));
      setName("");
      setScheduledAt("");
      setTimeZone(browserTimeZone());
      setFundsPercent("0");
      setPicked(null);
      setStartView(null);
      setErrors({});
    }
  }, [open]);

  const validate = (): { ok: boolean; body?: CreateEventBody } => {
    const next: Record<string, string> = {};
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      next.year = "Year must be between 2000 and 2100";
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 1) next.name = "Name is required";
    else if (trimmedName.length > 200)
      next.name = "Name must be 200 characters or fewer";
    const fp = Number(fundsPercent);
    if (!Number.isInteger(fp) || fp < 0 || fp > 100)
      next.fundsPercent = "Must be a whole number between 0 and 100";
    if (!boxOk) next.trackerBbox = "Fix the tracker area";
    if (startView !== null && !startViewInside(startView, box))
      next.trackerStartView = "The start view must lie inside the tracker area";
    setErrors(next);
    if (Object.keys(next).length > 0) return { ok: false };
    return {
      ok: true,
      body: {
        year: y,
        name: trimmedName,
        scheduledAt: wallTimeToUtc(scheduledAt, timeZone),
        scheduleTimeZone: timeZone,
        fundsPercent: fp,
        // Before the maps load the choice is unknown, and an absent id
        // lets the API inherit the map as it always has.
        ...(picked !== null || mapsQ.data !== undefined ? { trackerMapId: area.mapId } : {}),
        trackerBbox: box,
        ...(startView !== null ? { trackerStartView: startView } : {}),
      },
    };
  };

  const handleSubmit = () => {
    const r = validate();
    if (r.ok && r.body) onSubmit(r.body);
  };

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitleWithHelp help="events.create">New event</DialogTitleWithHelp>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? (
            <ErrorAlert
              error={error}
              handledFields={[
                ...Object.keys(errors),
                "trackerBbox",
                "trackerMapId",
                "trackerStartView",
              ]}
            />
          ) : null}
          <TextField
            label="Year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            error={!!errors.year}
            helperText={errors.year ?? ""}
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
          <TimeZoneSelect
            value={timeZone}
            onChange={(z) => {
              // Keep the instant a typed time names when the zone changes.
              setScheduledAt((wall) => shiftWallZone(wall, timeZone, z));
              setTimeZone(z);
            }}
            helperText="The scheduled time below is in this zone"
          />
          <TextField
            label="Scheduled at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText={
              scheduledAt
                ? formatStamp(wallTimeToUtc(scheduledAt, timeZone))
                : "Optional"
            }
            fullWidth
          />
          <TextField
            label="Funds percent"
            type="number"
            value={fundsPercent}
            onChange={(e) => setFundsPercent(e.target.value)}
            error={!!errors.fundsPercent}
            helperText={errors.fundsPercent ?? ""}
            fullWidth
            inputProps={{ min: 0, max: 100 }}
          />
          <Box>
            <TrackerAreaField
              value={area}
              onChange={setPicked}
              exportName={name.trim() || "New event"}
              bboxHelp="events.create.bbox"
              bboxError={fieldErrorFor(error, "trackerBbox")}
              mapError={fieldErrorFor(error, "trackerMapId")}
            />
            <Box sx={{ mt: 2 }}>
              <StartViewField
                value={startView}
                onChange={setStartView}
                bbox={box}
                error={errors.trackerStartView ?? fieldErrorFor(error, "trackerStartView")}
              />
            </Box>
            <Alert
              severity="info"
              variant="outlined"
              sx={{ mt: 1 }}
              data-testid="tracker-preview"
            >
              {trackerLine}
            </Alert>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !boxOk}
        >
          Create
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
