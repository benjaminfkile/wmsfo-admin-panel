import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
  Box,
  Alert,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { RouteUploadBody } from "../../api/resources/routes";
import { checkRouteFile, type RouteCheck } from "../../validation/routeFile";
import ErrorAlert from "../../components/ErrorAlert";
import { formatMt } from "../../lib/time";
import { downloadText } from "../../lib/download";
import routeFixture from "../../../contracts/fixtures/route.json";
import { useNotify } from "../../hooks/useNotify";

interface Props {
  open: boolean;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (body: RouteUploadBody) => void;
}

const RULE_LINES = [
  "name: 1 to 200 characters",
  "points: 2 to 50,000 in flight order",
  "lat -90 to 90, lng -180 to 180",
  "recordedAt: an RFC 3339 time or null",
  "no other keys; at most 5 MB",
];

// The Expected shape panel builds its example from the vendored
// contracts fixture with schemaVersion stripped, so the panel never
// drifts from the contract.
function buildExampleJson(): string {
  const source = routeFixture as Record<string, unknown>;
  const example: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (k === "schemaVersion") continue;
    example[k] = v;
  }
  return JSON.stringify(example, null, 2);
}

export const ROUTE_EXAMPLE_JSON = buildExampleJson();

export default function RouteUploadDialog({
  open,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const notify = useNotify();
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

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(ROUTE_EXAMPLE_JSON).then(
        () => notify("Example copied"),
        () => notify("Copy failed", "error")
      );
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    downloadText(ROUTE_EXAMPLE_JSON, "route-example.json", "application/json");
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
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              p: 2,
            }}
            data-testid="route-shape-panel"
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2">Expected shape</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  aria-label="Copy example"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                <Link
                  component="a"
                  href="#"
                  onClick={handleDownload}
                  variant="body2"
                >
                  Download example
                </Link>
              </Stack>
            </Stack>
            <Box
              component="pre"
              data-testid="route-shape-example"
              sx={{
                m: 0,
                p: 1,
                fontFamily: "monospace",
                fontSize: "0.8125rem",
                bgcolor: "action.hover",
                borderRadius: 1,
                overflow: "auto",
              }}
            >
              {ROUTE_EXAMPLE_JSON}
            </Box>
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 3 }}>
              {RULE_LINES.map((r) => (
                <li key={r}>
                  <Typography variant="body2">{r}</Typography>
                </li>
              ))}
            </Box>
          </Box>
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
