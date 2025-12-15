import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Stack,
} from "@mui/material";

import { api } from "../api";
import {
  IDashboardConfigResponse,
  ISantaFlyoverResponse,
} from "../interfaces";
import EventModeOverrideWarning from "../components/common/EventModeOverrideWarning";
import { ThemedJsonView } from "../components/common/ThemedJSONView";

const EVENT_MODE_LABELS: Record<number, string> = {
  0: "Pre-Show",
  1: "Run-Show",
  2: "End-Show",
};

export default function Dashboard() {
  const [config, setConfig] =
    useState<IDashboardConfigResponse | null>(null);
  const [location, setLocation] =
    useState<ISantaFlyoverResponse | null>(null);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const pollConfig = async () => {
      try {
        const res = await api.dashboardConfig.get();
        if (!cancelled) {
          setConfig(res);
          setLoadingConfig(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load dashboard"
          );
        }
      }
    };

    pollConfig(); // immediate
    const interval = window.setInterval(pollConfig, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);


  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await api.location.get();
        if (!cancelled) {
          setLocation(res);
        }
      } catch {
        // transient errors are fine
      }
    };

    poll(); // immediate
    const interval = setInterval(poll, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loadingConfig) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !config) {
    return (
      <Alert severity="error">
        Failed to load dashboard: {error ?? "Unknown error"}
      </Alert>
    );
  }

  const { currentTrackingMode } = config.appState;

  const eventModeLabel =
    //@ts-ignore
    location && EVENT_MODE_LABELS[location.mode]
      //@ts-ignore
      ? EVENT_MODE_LABELS[location.mode]
      : "Unknown";

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Stack spacing={2}>
        {/* ================= TRACKING MODE ================= */}
        <Card>
          <CardContent>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6">Tracking Mode</Typography>

              <Button
                component={RouterLink}
                to="/tracking-mode"
                size="small"
                variant="outlined"
              >
                Change
              </Button>
            </Stack>

            <Typography sx={{ mt: 1 }}>
              Mode:{" "}
              <strong>{currentTrackingMode.mode_name}</strong>
            </Typography>

            <Chip
              label={
                currentTrackingMode.is_active
                  ? "Active"
                  : "Inactive"
              }
              color={
                currentTrackingMode.is_active
                  ? "success"
                  : "default"
              }
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6">Event Mode</Typography>

              <Button
                component={RouterLink}
                to="/event-mode"
                size="small"
                variant="outlined"
              >
                Change
              </Button>
            </Stack>

            <Typography sx={{ mt: 1 }}>
              Mode: <strong>{eventModeLabel}</strong>
            </Typography>
          </CardContent>
        </Card>

        <EventModeOverrideWarning showLink/>

        {location && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Raw Location JSON
              </Typography>

              <ThemedJsonView value={location} />
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
