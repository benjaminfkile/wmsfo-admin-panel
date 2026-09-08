import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import type { Event, Route } from "../../api/types";
import type { CreateEventBody } from "../../api/resources/events";
import ErrorAlert from "../../components/ErrorAlert";
import { fromLocalInputValue, formatMt } from "../../lib/time";

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
  const [fundsPercent, setFundsPercent] = useState("0");
  const [routeChoice, setRouteChoice] = useState<RouteChoice>("inherit");
  const [routeId, setRouteId] = useState<number | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setYear(String(new Date().getFullYear()));
      setName("");
      setScheduledAt("");
      setFundsPercent("0");
      setRouteChoice("inherit");
      setRouteId("");
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
    setErrors(next);
    if (Object.keys(next).length > 0) return { ok: false };
    return {
      ok: true,
      body: {
        year: y,
        name: trimmedName,
        scheduledAt: fromLocalInputValue(scheduledAt),
        fundsPercent: fp,
        routeId:
          routeChoice === "choose" ? Number(routeId) : null,
        inheritRoute: routeChoice === "inherit",
      },
    };
  };

  const handleSubmit = () => {
    const r = validate();
    if (r.ok && r.body) onSubmit(r.body);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>New event</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? (
            <ErrorAlert
              error={error}
              handledFields={Object.keys(errors)}
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
          <TextField
            label="Scheduled at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText={
              scheduledAt
                ? formatMt(fromLocalInputValue(scheduledAt))
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
