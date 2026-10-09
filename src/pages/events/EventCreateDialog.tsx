import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import AppDialog from "../../components/AppDialog";
import type { Event, Route } from "../../api/types";
import type { CreateEventBody } from "../../api/resources/events";
import ErrorAlert from "../../components/ErrorAlert";
import TimeZoneSelect from "../../components/TimeZoneSelect";
import { browserTimeZone, formatStamp, shiftWallZone, wallTimeToUtc } from "../../lib/time";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";
import BboxEditor from "../../components/bbox/BboxEditor";
import { bboxValid, siteDefaultBbox, type Bbox } from "../../components/bbox/bbox";
import { siteSettings as siteSettingsApi } from "../../api/resources/siteSettings";
import { maps as mapsApi } from "../../api/resources/maps";
import { themes as themesApi } from "../../api/resources/themes";
import { keys } from "../../queries/keys";
import { fieldErrorFor } from "../../lib/fieldErrors";
import { trackerPreviewLine } from "./trackerPreview";

type RouteChoice = "inherit" | "choose" | "none";

interface Props {
  open: boolean;
  events: Event[];
  routes: Route[];
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (body: CreateEventBody) => void;
}

export default function EventCreateDialog({
  open,
  events,
  routes,
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
  const [routeChoice, setRouteChoice] = useState<RouteChoice>("inherit");
  const [routeId, setRouteId] = useState<number | "">("");
  // The drawn box, or null while it follows the site setting.
  const [bbox, setBbox] = useState<Bbox | null>(null);
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
  const box = bbox ?? siteBox;
  const trackerLine = trackerPreviewLine(
    events,
    mapsQ.data?.items ?? [],
    themesQ.data?.items ?? [],
    box
  );

  useEffect(() => {
    if (open) {
      setYear(String(new Date().getFullYear()));
      setName("");
      setScheduledAt("");
      setTimeZone(browserTimeZone());
      setFundsPercent("0");
      setRouteChoice("inherit");
      setRouteId("");
      setBbox(null);
      setErrors({});
    }
  }, [open]);

  // Preview which route the "inherit" rule selects.
  const inheritPreview = useMemo(() => {
    const withRoutes = events.filter((e) => e.routeId !== null);
    if (withRoutes.length === 0) return null;
    const latest = withRoutes.reduce((a, b) =>
      Number(a.year) >= Number(b.year) ? a : b
    );
    const route =
      routes.find((r) => Number(r.id) === Number(latest.routeId)) ?? null;
    return { event: latest, route };
  }, [events, routes]);

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
    if (routeChoice === "choose" && routeId === "")
      next.routeId = "Choose a route";
    if (!bboxValid(box)) next.trackerBbox = "Fix the tracker area";
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
        routeId:
          routeChoice === "choose" ? Number(routeId) : null,
        inheritRoute: routeChoice === "inherit",
        trackerBbox: box,
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
              handledFields={[...Object.keys(errors), "trackerBbox"]}
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
          <FormControl>
            <FormLabel>Route</FormLabel>
            <RadioGroup
              value={routeChoice}
              onChange={(e) => setRouteChoice(e.target.value as RouteChoice)}
            >
              <FormControlLabel
                value="inherit"
                control={<Radio />}
                label="Inherit the most recent route"
              />
              {routeChoice === "inherit" ? (
                <Box sx={{ ml: 4, mb: 1 }}>
                  {inheritPreview ? (
                    <Alert severity="info" variant="outlined">
                      Will inherit{" "}
                      {inheritPreview.route?.name ??
                        `route #${inheritPreview.event.routeId}`}{" "}
                      from {inheritPreview.event.name}
                    </Alert>
                  ) : (
                    <Alert severity="warning" variant="outlined">
                      No earlier event has a route
                    </Alert>
                  )}
                </Box>
              ) : null}
              <FormControlLabel
                value="choose"
                control={<Radio />}
                label="Choose a route"
              />
              {routeChoice === "choose" ? (
                <Box sx={{ ml: 4, mb: 1 }}>
                  <FormControl fullWidth error={!!errors.routeId}>
                    <Select
                      displayEmpty
                      value={routeId === "" ? "" : String(routeId)}
                      onChange={(e) =>
                        setRouteId(e.target.value === "" ? "" : Number(e.target.value))
                      }
                    >
                      <MenuItem value="">
                        <em>Select a route…</em>
                      </MenuItem>
                      {routes.map((r) => (
                        <MenuItem key={String(r.id)} value={String(r.id)}>
                          {r.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.routeId ? (
                      <Typography variant="caption" color="error">
                        {errors.routeId}
                      </Typography>
                    ) : null}
                  </FormControl>
                </Box>
              ) : null}
              <FormControlLabel
                value="none"
                control={<Radio />}
                label="No route"
              />
            </RadioGroup>
          </FormControl>
          <Box>
            <BboxEditor
              label="Tracker area"
              value={box}
              onChange={setBbox}
              exportName={name.trim() || "New event"}
              help="events.create.bbox"
              error={fieldErrorFor(error, "trackerBbox")}
            />
            <Button
              size="small"
              onClick={() => setBbox(siteBox)}
              sx={{ mt: 1 }}
            >
              Use site default
            </Button>
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
          disabled={submitting || !bboxValid(box)}
        >
          Create
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
