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

/* ================= HELPERS ================= */

function formatPrefix(): string {
  const d = new Date();

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear().toString().slice(-2);

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";

  hours = hours % 12 || 12;

  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm} -- `;
}

function splitIsoToInputs(iso?: string) {
  if (!iso) return { date: "", time: "" };

  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);

  return { date, time };
}

function buildEventTime(date: string, time: string): string | undefined {
  if (!date || !time) return undefined;
  return new Date(`${date}T${time}:00`).toISOString();
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

  /* ================= LOAD LATEST ================= */
  useEffect(() => {
    api.eventUpdates
      .getLatest()
      .then((data) => {
        setLatest(data);

        // Prefill date/time inputs from last event
        const { date, time } = splitIsoToInputs(data.time);
        setEventDate(date);
        setEventTime(time);
      })
      .catch(() => setLatest(null));
  }, []);

  /* ================= SUBMIT ================= */
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

      // Re-sync inputs with what was actually saved
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

  /* ================= CLEAR TIME ================= */
  const handleClearTime = () => {
    setEventDate("");
    setEventTime("");
  };

  /* ================= UI ================= */
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Event Message
      </Typography>

      {/* ===== CURRENT MESSAGE ===== */}
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
                  Event Time: {new Date(latest.time).toLocaleString()}
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

      {/* ===== EDIT ===== */}
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
            label="Prefix message with current date/time"
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
