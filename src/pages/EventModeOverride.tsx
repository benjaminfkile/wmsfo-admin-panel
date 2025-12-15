import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Stack,
  TextField,
  Alert,
  Divider,
} from "@mui/material";

import { api } from "../api";
import { IEventModeOverride } from "../interfaces";
import EventModeOverrideWarning from "../components/common/EventModeOverrideWarning";
import CommentBox from "../components/common/CommentBox";
import LiveTrackerView from "../components/common/LiveTrackerView";

const EVENT_MODES = [
  { id: 0, label: "Pre-Show" },
  { id: 1, label: "Run-Show" },
  { id: 2, label: "End-Show" },
];

const ONE_THOUSAND_YEARS = 1000 * 365 * 24 * 60 * 60 * 1000;

export default function EventModeOverride() {
  const [activeOverride, setActiveOverride] =
    useState<IEventModeOverride | null>(null);
  const [mode, setMode] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.eventModeOverride
      .getActive()
      .then(setActiveOverride)
      .catch(() => {
        // 404 = no active override → expected
        setActiveOverride(null);
      });
  }, []);

  const handleSetOverride = async () => {
    if (mode === null) return;

    const finalExpiresAt =
      expiresAt.trim() === ""
        ? new Date(Date.now() + ONE_THOUSAND_YEARS).toISOString()
        : new Date(expiresAt).toISOString();

    try {
      setSaving(true);
      await api.eventModeOverride.set({
        mode,
        expires_at: finalExpiresAt,
      });

      const refreshed = await api.eventModeOverride.getActive();
      setActiveOverride(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set override");
    } finally {
      setSaving(false);
    }
  };

  const handleExpireAll = async () => {
    try {
      setSaving(true);
      await api.eventModeOverride.expireAll();
      setActiveOverride(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to expire overrides"
      );
    } finally {
      setSaving(false);
    }
  };


  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Event Mode Override
      </Typography>

      <EventModeOverrideWarning override={activeOverride} />

      <CommentBox title="How Event Mode Overrides Work">
        <Typography variant="body2" component="div">
          Event mode overrides force the system into a specific mode regardless
          of the normal event flow.
          <ul>
            <li>
              Overrides apply immediately and take precedence over all other
              mode logic
            </li>
            <li>
              Overrides remain active until they expire or are manually cleared
            </li>
            <li>
              If no expiration date is provided, the override will expire in
              approximately <strong>1000 years</strong>
            </li>
          </ul>
        </Typography>
      </CommentBox>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Set Override
          </Typography>

          <RadioGroup
            value={mode ?? ""}
            onChange={(e) => setMode(Number(e.target.value))}
          >
            <Stack spacing={1}>
              {EVENT_MODES.map((m) => (
                <FormControlLabel
                  key={m.id}
                  value={m.id}
                  control={<Radio />}
                  label={m.label}
                />
              ))}
            </Stack>
          </RadioGroup>

          <TextField
            label="Expires At (optional)"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 3, maxWidth: 320 }}
          />

          <Box mt={3}>
            <Button
              variant="contained"
              onClick={handleSetOverride}
              disabled={saving || mode === null}
            >
              Set Override
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Divider sx={{ my: 4 }} />

      <Button
        color="error"
        variant="outlined"
        onClick={handleExpireAll}
        disabled={saving}
      >
        Expire All Overrides
      </Button>
      <LiveTrackerView/>
    </Box>
  );
}
