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
  Alert,
} from "@mui/material";

import { api } from "../api";
import { ITrackingMode } from "../interfaces";
import trackingModes from "../constants/trackingModes";
import CommentBox from "../components/common/CommentBox";

export default function TrackingMode() {
  const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* =========================================
     LOAD ACTIVE MODE
     ========================================= */
  useEffect(() => {
    api.trackingMode
      .getModes()
      .then((modes: ITrackingMode[]) => {
        const active = modes.find((m) => m.is_active);
        if (active) {
          setActiveTypeId(active.tracking_mode_type_id);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load modes");
      });
  }, []);

  /* =========================================
     ACTIVATE MODE
     ========================================= */
  const handleActivate = async () => {
    if (!activeTypeId) return;

    try {
      setSaving(true);
      await api.trackingMode.activate(activeTypeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate mode");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Tracking Mode
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <RadioGroup
        value={activeTypeId ?? ""}
        onChange={(e) => setActiveTypeId(Number(e.target.value))}
      >
        <Stack spacing={2}>
          {trackingModes.map((mode) => (
            <Card key={mode.id}>
              <CardContent>
                <FormControlLabel
                  value={mode.id}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography fontWeight={600}>
                        {mode.mode_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {mode.description}
                      </Typography>
                    </Box>
                  }
                />
              </CardContent>
            </Card>
          ))}
        </Stack>
      </RadioGroup>

      {activeTypeId === 2 && (
        <Box mt={2}>
          <CommentBox variant="warning" title="Important Behavior">
            <Typography variant="body2" component="div">
              If you switch to <strong>Secondary (TrackiPro)</strong>:
              <ul>
                <li>The event mode is <strong>forced into Run-Show</strong></li>
                <li>Manual switching to Pre-Show or End-Show is disabled</li>
                <li>This override remains active while TrackiPro is selected</li>
              </ul>
              <strong>To exit Run-Show:</strong>
              <ol>
                <li>Switch tracking back to Primary (Legacy Cell Phone)</li>
                <li>Then manually select Pre-Show or End-Show</li>
              </ol>
            </Typography>
          </CommentBox>
        </Box>
      )}

      <Box mt={3}>
        <Button
          variant="contained"
          onClick={handleActivate}
          disabled={saving || !activeTypeId}
        >
          Activate Selected Mode
        </Button>
      </Box>
    </Box>
  );
}
