import { useEffect, useRef, useState } from "react";
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
  Alert,
  CircularProgress,
} from "@mui/material";

import { api } from "../api";
import EventModeOverrideWarning from "../components/common/EventModeOverrideWarning";
import { ThemedJsonView } from "../components/common/ThemedJSONView";

type EventModeValue = 0 | 1 | 2;
type InteractionState = "idle" | "selecting" | "verifying";

const EVENT_MODES = [
  { id: 0, label: "Pre-Show" },
  { id: 1, label: "Run-Show" },
  { id: 2, label: "End-Show" },
];

export default function EventMode() {
  const [currentMode, setCurrentMode] = useState<EventModeValue | null>(null);
  const [selectedMode, setSelectedMode] = useState<EventModeValue | null>(null);
  const [locationJson, setLocationJson] = useState<any | null>(null);

  const [interaction, setInteraction] =
    useState<InteractionState>("idle");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedModeRef = useRef<EventModeValue | null>(null);

  /* ======================================================
     POLL LOCATION (SOURCE OF TRUTH)
     ====================================================== */
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const location = await api.location.get();
        const liveMode = location.mode as EventModeValue;

        if (cancelled) return;

        setLocationJson(location);
        setCurrentMode(liveMode);

        // 🟢 ONLY sync selection when user is idle
        if (interaction === "idle") {
          setSelectedMode(liveMode);
          return;
        }

        // 🟡 Verifying a requested change
        if (
          interaction === "verifying" &&
          expectedModeRef.current !== null
        ) {
          if (liveMode === expectedModeRef.current) {
            // confirmed
            expectedModeRef.current = null;
            setInteraction("idle");
            setSelectedMode(liveMode);
          }
        }
      } catch {
        // non-fatal
      }
    };

    poll();
    const interval = setInterval(poll, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [interaction]);

  /* ======================================================
     APPLY MODE
     ====================================================== */
  const handleApply = async () => {
    if (selectedMode === null) return;

    try {
      setSaving(true);
      setError(null);

      expectedModeRef.current = selectedMode;
      setInteraction("verifying");

      if (selectedMode === 1) {
        await api.eventMode.runShow();
      } else {
        await api.eventMode.setMode(selectedMode);
      }
    } catch (err) {
      expectedModeRef.current = null;
      setInteraction("idle");
      setError(err instanceof Error ? err.message : "Failed to change mode");
    } finally {
      setSaving(false);
    }
  };

  /* ======================================================
     UI
     ====================================================== */
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Event Mode
      </Typography>

      <EventModeOverrideWarning showLink />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* CURRENT MODE */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">Current Mode</Typography>

          {currentMode !== null ? (
            <Typography sx={{ mt: 1 }}>
              <strong>
                {EVENT_MODES.find((m) => m.id === currentMode)?.label}
              </strong>
            </Typography>
          ) : (
            <Typography color="text.secondary">Loading…</Typography>
          )}

          {interaction === "verifying" && (
            <Stack direction="row" spacing={1} mt={2}>
              <CircularProgress size={16} />
              <Typography variant="body2">
                Waiting for tracker confirmation…
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* MODE SELECTION */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Select Mode
          </Typography>

          <RadioGroup
            value={selectedMode ?? ""}
            onChange={(e) => {
              setSelectedMode(Number(e.target.value) as EventModeValue);
              setInteraction("selecting"); // 🔒 lock polling
            }}
          >
            <Stack spacing={1}>
              {EVENT_MODES.map((m) => (
                <FormControlLabel
                  key={m.id}
                  value={m.id}
                  control={<Radio />}
                  label={m.label}
                  disabled={interaction === "verifying"}
                />
              ))}
            </Stack>
          </RadioGroup>

          <Box mt={3}>
            <Button
              variant="contained"
              onClick={handleApply}
              disabled={
                saving ||
                interaction === "verifying" ||
                selectedMode === null ||
                selectedMode === currentMode
              }
            >
              Apply Mode
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* RAW JSON */}
      {locationJson && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6">Raw Location JSON</Typography>
            <ThemedJsonView value={locationJson} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
