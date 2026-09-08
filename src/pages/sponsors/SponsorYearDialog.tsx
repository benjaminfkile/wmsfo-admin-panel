import { useEffect, useState } from "react";
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
import ErrorAlert from "../../components/ErrorAlert";
import {
  toSponsorYearBody,
  validateSponsorYear,
  type SponsorYearErrors,
  type SponsorYearInput,
} from "../../validation/sponsor";
import type { SponsorYear } from "../../api/types";

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
    }
  ) => void;
}

const EMPTY: SponsorYearInput = {
  eventYear: "",
  amountDonated: "",
  active: true,
  canAdvertise: true,
  anonymous: false,
};

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
      });
    } else {
      setInput(EMPTY);
    }
    setErrors({});
  }, [open, edit]);

  const submit = () => {
    const errs = validateSponsorYear(input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(Number(input.eventYear), toSponsorYearBody(input));
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{edit ? "Edit year" : "Add year"}</DialogTitle>
      <DialogContent>
        {error ? <ErrorAlert error={error} /> : null}
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
