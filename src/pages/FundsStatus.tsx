import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
} from "@mui/material";

import { api } from "../api";
import { IFund } from "../interfaces";

export default function FundsStatus() {
  const [current, setCurrent] = useState<number | null>(null);
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.funds
      .get()
      .then((fund: IFund) => {
        setCurrent(fund.percent);
        setValue(String(fund.percent));
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load fund status"
        );
      });
  }, []);

  const handleSave = async () => {
    const num = Number(value);

    if (isNaN(num) || num < 0 || num > 100) {
      setError("Value must be a number between 0 and 100");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await api.funds.set(num);

      setCurrent(num);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update fund status"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cheer Meter
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">Current Value</Typography>

          <Typography sx={{ mt: 1 }}>
            <strong>{current ?? "—"}</strong>%
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Update Value
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="Percent (0–100)"
              type="number"
              inputProps={{ min: 0, max: 100 }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              sx={{ maxWidth: 160 , width: 80}}
            />

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
            >
              Save
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
