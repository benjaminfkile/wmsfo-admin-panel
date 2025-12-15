import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Alert,
} from "@mui/material";

import { api } from "../api";
import { IEventUpdate } from "../interfaces";

/* ================= CONFIG ================= */

const FORCED_TIMEZONE = process.env.REACT_APP_FORCED_TIMEZONE;
const FORCED_TIME_ABBR = process.env.REACT_APP_FORCED_TIME_ABBR;

/* ================= HELPERS ================= */

/**
 * Format "now" for prefix (same rules as PreShow)
 */
function formatPrefix(): string {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  };

  if (FORCED_TIMEZONE) {
    options.timeZone = FORCED_TIMEZONE;
  }

  const formatted = new Date().toLocaleString("en-US", options);
  return `${formatted}${FORCED_TIME_ABBR ? ` ${FORCED_TIME_ABBR}` : ""} -- `;
}

/**
 * Split ISO → date/time inputs using SAME display logic as PreShow
 */
function splitIsoToInputs(iso?: string) {
  if (!iso) return { date: "", time: "" };

  const d = new Date(iso);

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  if (FORCED_TIMEZONE) {
    options.timeZone = FORCED_TIMEZONE;
  }

  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(d);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}

/**
 * Build ISO timestamp from date + time
 * IMPORTANT: no forced timezone here — browser attaches offset
 */
function buildEventTime(date: string, time: string): string | undefined {
  if (!date || !time) return undefined;
  return new Date(`${date}T${time}:00`).toISOString();
}

/**
 * Display time EXACTLY like PreShow
 */
function formatEventTime(iso: string): string {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  };

  if (FORCED_TIMEZONE) {
    options.timeZone = FORCED_TIMEZONE;
  }

  return new Date(iso).toLocaleString("en-US", options);
}

/* ================= COMPONENT ================= */

export default function EventMessage() {
  const [latest, setLatest] = useState<IEventUpdate | null>(null);
  const [message, setMessage] = useState("");
  const [prefixWithDate, setPrefixWithDate] = useState(true);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* ===== LOAD LATEST ===== */
  useEffect(() => {
    api.eventUpdates
      .getLatest()
      .then((data) => {
        setLatest(data);

        const { date, time } = splitIsoToInputs(data.time);
        setEventDate(date);
        setEventTime(time);
      })
      .catch(() => setLatest(null));
  }, []);

  /* ===== SUBMIT ===== */
  const handleSubmit = async () => {
    if (!message.trim()) return;

    try {
      setSaving(true);
      setError(null);

      const finalMessage = prefixWithDate
        ? `${formatPrefix()}${message}`
        : message;

      await api.eventUpdates.post({
        message: finalMessage,
        time: buildEventTime(eventDate, eventTime),
      });

      const refreshed = await api.eventUpdates.getLatest();
      setLatest(refreshed);

      const { date, time } = splitIsoToInputs(refreshed.time);
      setEventDate(date);
      setEventTime(time);

      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post message");
    } finally {
      setSaving(false);
    }
  };

  /* ===== CLEAR TIME ===== */
  const handleClearTime = () => {
    setEventDate("");
    setEventTime("");
  };

  /* ===== UI ===== */
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Event Message
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">Current Message</Typography>

          {latest ? (
            <>
              <Typography sx={{ mt: 1 }}>
                {latest.message || <em>(empty)</em>}
              </Typography>

              {latest.time && (
                <Typography variant="body2" color="text.secondary">
                  Event Time: {formatEventTime(latest.time)}
                  {FORCED_TIME_ABBR ? ` ${FORCED_TIME_ABBR}` : ""}
                </Typography>
              )}
            </>
          ) : (
            <Typography color="text.secondary">
              No active message
            </Typography>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Update Message
          </Typography>

          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={prefixWithDate}
                onChange={(e) => setPrefixWithDate(e.target.checked)}
              />
            }
            label="Prefix message with date/time"
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={2}>
            <TextField
              type="date"
              label="Event Date"
              InputLabelProps={{ shrink: true }}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />

            <TextField
              type="time"
              label="Event Time"
              InputLabelProps={{ shrink: true }}
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
            />

            <Button
              variant="outlined"
              color="error"
              onClick={handleClearTime}
              sx={{ alignSelf: "center" }}
            >
              Clear Time
            </Button>
          </Stack>

          <Stack direction="row" spacing={2} mt={3}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={saving || !message.trim()}
            >
              Submit
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
