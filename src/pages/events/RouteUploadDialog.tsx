import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  Box,
  Alert,
} from "@mui/material";
import type { RouteUploadBody } from "../../api/resources/routes";
import { checkRouteFile, type RouteCheck } from "../../validation/routeFile";
import ErrorAlert from "../../components/ErrorAlert";
import { formatMt } from "../../lib/time";

interface Props {
  open: boolean;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (body: RouteUploadBody) => void;
}

export default function RouteUploadDialog({
  open,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [check, setCheck] = useState<RouteCheck | null>(null);
  const [name, setName] = useState("");

  const reset = () => {
    setCheck(null);
    setName("");
  };

  const onFileChosen = async (file: File) => {
    const text = await file.text();
    const c = checkRouteFile(text, file.size);
    setCheck(c);
    if (c.ok) setName(c.body.name);
  };

  const handleSubmit = () => {
    if (check && check.ok) {
      onSubmit({ name: name.trim(), points: check.body.points });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        onCancel();
        reset();
      }}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Upload route</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <ErrorAlert error={error} /> : null}
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Route JSON file"
            data-testid="route-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFileChosen(file);
            }}
          />
          {check && !check.ok ? (
            <Alert severity="error">
              <Typography variant="body2" gutterBottom>
                {check.total} issue{check.total === 1 ? "" : "s"}
                {check.total > check.issues.length
                  ? ` (showing first ${check.issues.length})`
                  : ""}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 3 }}>
                {check.issues.map((i, idx) => (
                  <li key={`${i.path}-${idx}`}>
                    <Typography variant="body2">
                      <code>{i.path}</code>: {i.message}
                    </Typography>
                  </li>
                ))}
              </Box>
            </Alert>
          ) : null}
          {check && check.ok ? (
            <>
              <TextField
                label="Route name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
              />
              <Alert severity="success" variant="outlined">
                <Typography variant="body2">
                  {check.summary.points} points; bounding box lat [
                  {check.summary.latMin.toFixed(4)},{" "}
                  {check.summary.latMax.toFixed(4)}] lng [
                  {check.summary.lngMin.toFixed(4)},{" "}
                  {check.summary.lngMax.toFixed(4)}]
                </Typography>
                {check.summary.firstAt ? (
                  <Typography variant="body2">
                    First point: {formatMt(check.summary.firstAt)}
                  </Typography>
                ) : null}
                {check.summary.lastAt ? (
                  <Typography variant="body2">
                    Last point: {formatMt(check.summary.lastAt)}
                  </Typography>
                ) : null}
              </Alert>
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onCancel();
            reset();
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!check || !check.ok || submitting || name.trim().length < 1}
        >
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
}
