import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
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

interface Props {
  open: boolean;
  source: Event | null;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (body: CloneEventBody) => void;
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
  const [route, setRoute] = useState(true);
  const [poster, setPoster] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !source) return;
    const sourceYear = Number(source.year);
    const targetYear = sourceYear + 1;
    setYear(String(targetYear));
    setName(defaultName(source, sourceYear, targetYear));
    setSponsors(true);
    setRoute(true);
    setPoster(true);
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
    setErrors(next);
    if (Object.keys(next).length > 0) return { ok: false };
    return {
      ok: true,
      body: {
        year: y,
        name: trimmedName,
        copy: { sponsors, route, poster },
      },
    };
  };

  const handleSubmit = () => {
    const r = validate();
    if (r.ok && r.body) onSubmit(r.body);
  };

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Clone event</DialogTitle>
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
              handledFields={[...Object.keys(errors), "year"]}
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
            <FormControlLabel
              control={
                <Checkbox
                  checked={route}
                  onChange={(_, v) => setRoute(v)}
                />
              }
              label="Flight history"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={poster}
                  onChange={(_, v) => setPoster(v)}
                />
              }
              label="Route poster"
            />
          </FormGroup>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
        >
          Clone
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
