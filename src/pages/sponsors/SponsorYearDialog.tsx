import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import ErrorAlert from "../../components/ErrorAlert";
import {
  computeLingerMs,
  toSponsorYearBody,
  validateSponsorYear,
  type SponsorYearErrors,
  type SponsorYearInput,
} from "../../validation/sponsor";
import { settings as settingsApi } from "../../api/resources/settings";
import { keys } from "../../queries/keys";
import { fieldErrorFor } from "../../lib/fieldErrors";
import { ApiError } from "../../api/errors";
import type { Setting, SponsorYear } from "../../api/types";

interface Props {
  open: boolean;
  edit: SponsorYear | null;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (
    eventYear: number,
    body: {
      amountDonated: number | null;
      active: boolean;
      canAdvertise: boolean;
      anonymous: boolean;
      pinnedPosition: number | null;
      lingerMsOverride: number | null;
    }
  ) => void;
}

const EMPTY: SponsorYearInput = {
  eventYear: "",
  amountDonated: "",
  active: true,
  canAdvertise: true,
  anonymous: false,
  lingerMsOverride: "",
  pinnedPosition: "",
};

function settingValue(items: Setting[] | undefined, key: string): number | null {
  const s = items?.find((row) => row.key === key);
  if (!s) return null;
  const v = s.value;
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export default function SponsorYearDialog({
  open,
  edit,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [input, setInput] = useState<SponsorYearInput>(EMPTY);
  const [errors, setErrors] = useState<SponsorYearErrors>({});

  const settingsQ = useQuery({
    queryKey: keys.settings,
    queryFn: () => settingsApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setInput({
        eventYear: String(edit.eventYear ?? ""),
        amountDonated:
          edit.amountDonated === null || edit.amountDonated === undefined
            ? ""
            : String(edit.amountDonated),
        active: Boolean(edit.active),
        canAdvertise: Boolean(edit.canAdvertise),
        anonymous: Boolean(edit.anonymous),
        lingerMsOverride:
          edit.lingerMsOverride === null ||
          edit.lingerMsOverride === undefined
            ? ""
            : String(Number(edit.lingerMsOverride) / 1000),
        pinnedPosition:
          edit.pinnedPosition === null || edit.pinnedPosition === undefined
            ? ""
            : String(edit.pinnedPosition),
      });
    } else {
      setInput(EMPTY);
    }
    setErrors({});
  }, [open, edit]);

  const settingsItems = settingsQ.data?.items;
  const msPerDollar = settingValue(settingsItems, "sponsor_linger_ms_per_dollar");
  const minMs = settingValue(settingsItems, "sponsor_linger_min_ms");

  const computedLingerHelp = useMemo(() => {
    if (msPerDollar === null || minMs === null) {
      return "Blank means computed from the amount.";
    }
    const amountRaw = input.amountDonated.trim();
    const amountDonated = amountRaw === "" ? null : Number(amountRaw);
    if (amountRaw !== "" && !Number.isFinite(amountDonated)) {
      return "Blank means computed from the amount.";
    }
    const ms = computeLingerMs({
      amountDonated,
      msPerDollar,
      minMs,
    });
    const seconds = (ms / 1000).toFixed(1);
    return `Blank means computed from the amount (${seconds} s at ${msPerDollar} ms/$ and ${minMs} ms minimum).`;
  }, [input.amountDonated, msPerDollar, minMs]);

  const submit = () => {
    const errs = validateSponsorYear(input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(Number(input.eventYear), toSponsorYearBody(input));
  };

  const serverPinned =
    fieldErrorFor(error, "pinnedPosition") ??
    (error instanceof ApiError && error.code === "pinned_position_taken"
      ? "Position is taken for this year; use Sponsor order to rearrange"
      : null);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{edit ? "Edit year" : "Add year"}</DialogTitle>
      <DialogContent>
        {error ? (
          <ErrorAlert
            error={error}
            handledFields={["pinnedPosition"]}
          />
        ) : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Event year"
            type="number"
            value={input.eventYear}
            onChange={(e) => setInput({ ...input, eventYear: e.target.value })}
            disabled={edit !== null}
            error={Boolean(errors.eventYear)}
            helperText={errors.eventYear ?? " "}
            required
            fullWidth
          />
          <TextField
            label="Amount donated"
            value={input.amountDonated}
            onChange={(e) =>
              setInput({ ...input, amountDonated: e.target.value })
            }
            error={Boolean(errors.amountDonated)}
            helperText={
              errors.amountDonated ??
              "Empty means no amount recorded"
            }
            fullWidth
          />
          <FormControlLabel
            label="Active"
            control={
              <Switch
                checked={input.active}
                onChange={(_, v) => setInput({ ...input, active: v })}
              />
            }
          />
          <FormControlLabel
            label="Can advertise"
            control={
              <Switch
                checked={input.canAdvertise}
                onChange={(_, v) => setInput({ ...input, canAdvertise: v })}
              />
            }
          />
          <FormControlLabel
            label="Anonymous"
            control={
              <Switch
                checked={input.anonymous}
                onChange={(_, v) => setInput({ ...input, anonymous: v })}
              />
            }
          />
          <TextField
            label="Tracker time override (seconds)"
            type="number"
            value={input.lingerMsOverride}
            onChange={(e) =>
              setInput({ ...input, lingerMsOverride: e.target.value })
            }
            error={Boolean(errors.lingerMsOverride)}
            helperText={errors.lingerMsOverride ?? computedLingerHelp}
            inputProps={{ min: 0, max: 600, step: 1 }}
            fullWidth
          />
          <TextField
            label="Pinned position"
            type="number"
            value={input.pinnedPosition}
            onChange={(e) =>
              setInput({ ...input, pinnedPosition: e.target.value })
            }
            error={Boolean(errors.pinnedPosition ?? serverPinned)}
            helperText={
              errors.pinnedPosition ??
              serverPinned ??
              "Use the Sponsor order page to rearrange pinned sponsors."
            }
            inputProps={{ min: 1, max: 1000, step: 1 }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={submitting}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
