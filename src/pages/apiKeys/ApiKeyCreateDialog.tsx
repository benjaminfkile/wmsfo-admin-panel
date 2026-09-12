import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ErrorAlert from "../../components/ErrorAlert";
import { ApiError } from "../../api/errors";
import { fieldErrorFor } from "../../lib/fieldErrors";
import { fromLocalInputValue, formatMt } from "../../lib/time";
import type { ApiKeyCreateBody } from "../../api/resources/apiKeys";
import type { ApiKeyCapability } from "../../api/types";

// Plain-word labels for the capability list (admin.md 6.20, 3.6).
// Kept in the order the doc lists them so the picker reads naturally.
export const CAPABILITY_LABELS: ReadonlyArray<{
  value: ApiKeyCapability;
  label: string;
}> = [
  { value: "events", label: "Events" },
  { value: "routes", label: "Flight recordings" },
  { value: "beacons", label: "Beacons" },
  { value: "sponsors", label: "Sponsors" },
  { value: "cookie_types", label: "Cookie types" },
  { value: "pages", label: "Pages" },
  { value: "sections", label: "Sections" },
  { value: "site_settings", label: "Site settings" },
  { value: "content", label: "Publish and versions" },
  { value: "media", label: "Media" },
  { value: "icons", label: "Icons" },
  { value: "cookies", label: "Cookie moderation" },
  { value: "settings", label: "Settings" },
  { value: "contact_messages", label: "Contact messages" },
  { value: "subscribers", label: "Subscribers" },
  { value: "people", label: "People" },
  { value: "diagnostics", label: "Diagnostics" },
];

interface Props {
  open: boolean;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (body: ApiKeyCreateBody) => void;
}

export default function ApiKeyCreateDialog({
  open,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [allCapabilities, setAllCapabilities] = useState(true);
  const [selected, setSelected] = useState<Set<ApiKeyCapability>>(new Set());
  const [neverExpires, setNeverExpires] = useState(true);
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setAllCapabilities(true);
      setSelected(new Set());
      setNeverExpires(true);
      setExpiresAtLocal("");
      setErrors({});
    }
  }, [open]);

  const serverName =
    fieldErrorFor(error, "name") ??
    (error instanceof ApiError && error.code === "name_taken"
      ? "A key with this name exists; revoke it or pick another name"
      : null);

  const validate = (): ApiKeyCreateBody | null => {
    const next: Record<string, string> = {};
    const trimmed = name.trim();
    if (trimmed.length < 1) next.name = "Name is required";
    else if (trimmed.length > 100)
      next.name = "Name must be 100 characters or fewer";
    if (!allCapabilities && selected.size === 0)
      next.capabilities = "Choose at least one capability";
    let expiresAt: string | null = null;
    if (!neverExpires) {
      const iso = fromLocalInputValue(expiresAtLocal);
      if (!iso) {
        next.expiresAt = "Enter a valid date and time";
      } else {
        const target = Date.parse(iso);
        if (target - Date.now() < 60 * 60 * 1000) {
          next.expiresAt = "Expiry must be at least one hour ahead";
        } else {
          expiresAt = iso;
        }
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return {
      name: trimmed,
      allCapabilities,
      capabilities: allCapabilities
        ? []
        : CAPABILITY_LABELS.map((c) => c.value).filter((v) => selected.has(v)),
      expiresAt,
    };
  };

  const handleSubmit = () => {
    const body = validate();
    if (body) onSubmit(body);
  };

  const toggleCapability = (value: ApiKeyCapability) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const expiresPreview = useMemo(() => {
    if (neverExpires) return "Never expires";
    const iso = fromLocalInputValue(expiresAtLocal);
    return iso ? formatMt(iso) : "Must be at least one hour ahead";
  }, [neverExpires, expiresAtLocal]);

  const nameTaken =
    error instanceof ApiError && error.code === "name_taken";
  const handledFields = ["name"];
  if (errors.capabilities) handledFields.push("capabilities");
  if (errors.expiresAt) handledFields.push("expiresAt");

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>New API key</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && !nameTaken ? (
            <ErrorAlert error={error} handledFields={handledFields} />
          ) : null}
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(errors.name ?? serverName)}
            helperText={errors.name ?? serverName ?? ""}
            fullWidth
            autoFocus
            inputProps={{ maxLength: 100 }}
          />
          <FormControlLabel
            label="All capabilities"
            control={
              <Switch
                checked={allCapabilities}
                onChange={(_, v) => setAllCapabilities(v)}
              />
            }
          />
          <Divider />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
              },
              gap: 0,
              opacity: allCapabilities ? 0.5 : 1,
            }}
          >
            {CAPABILITY_LABELS.map(({ value, label }) => (
              <FormControlLabel
                key={value}
                label={label}
                control={
                  <Checkbox
                    checked={allCapabilities || selected.has(value)}
                    onChange={() => toggleCapability(value)}
                    disabled={allCapabilities}
                  />
                }
              />
            ))}
          </Box>
          {errors.capabilities ? (
            <Typography variant="caption" color="error">
              {errors.capabilities}
            </Typography>
          ) : null}
          <Divider />
          <FormControlLabel
            label="Never expires"
            control={
              <Switch
                checked={neverExpires}
                onChange={(_, v) => setNeverExpires(v)}
              />
            }
          />
          <TextField
            label="Expires at"
            type="datetime-local"
            value={expiresAtLocal}
            onChange={(e) => setExpiresAtLocal(e.target.value)}
            InputLabelProps={{ shrink: true }}
            error={Boolean(errors.expiresAt)}
            helperText={errors.expiresAt ?? expiresPreview}
            disabled={neverExpires}
            fullWidth
          />
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
