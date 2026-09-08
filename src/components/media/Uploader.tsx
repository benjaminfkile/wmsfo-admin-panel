import { useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloseIcon from "@mui/icons-material/Close";
import ReplayIcon from "@mui/icons-material/Replay";
import type { MediaAsset } from "../../api/types";
import { RASTER_MAX_BYTES, SVG_MAX_BYTES } from "../../validation/image";
import { useMediaUpload, type UploadItem } from "./useMediaUpload";

interface Props {
  onReady?: (asset: MediaAsset) => void;
  compact?: boolean;
}

// The drop zone at the top of the media library (admin.md 6.15) and the
// inline uploader inside the MediaPicker's Upload tab.
export default function Uploader({ onReady, compact = false }: Props) {
  const upload = useMediaUpload(onReady);
  const [alt, setAlt] = useState("");
  const [title, setTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptFiles = (files: FileList | null): void => {
    if (!files || files.length === 0) return;
    upload.add(Array.from(files), { alt, title });
    setAlt("");
    setTitle("");
  };

  return (
    <Stack spacing={2}>
      {compact ? null : (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Alt (optional)"
            value={alt}
            onChange={(e) => setAlt(e.target.value.slice(0, 500))}
            inputProps={{ maxLength: 500 }}
            fullWidth
            size="small"
          />
          <TextField
            label="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 200))}
            inputProps={{ maxLength: 200 }}
            fullWidth
            size="small"
          />
        </Stack>
      )}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          textAlign: "center",
          borderStyle: "dashed",
          borderWidth: 2,
          bgcolor: dragActive ? "action.hover" : "transparent",
          cursor: "pointer",
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          acceptFiles(e.dataTransfer.files);
        }}
        role="button"
        aria-label="Drop files here or click to browse"
        data-testid="media-drop-zone"
      >
        <CloudUploadIcon fontSize="large" color="action" />
        <Typography variant="body1" sx={{ mt: 1 }}>
          Drop files here or click to browse
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          PNG, JPEG, WebP, GIF up to {formatBytes(RASTER_MAX_BYTES)}; SVG up to {formatBytes(SVG_MAX_BYTES)}
        </Typography>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          style={{ display: "none" }}
          onChange={(e) => acceptFiles(e.target.files)}
          data-testid="media-file-input"
        />
      </Paper>
      {upload.items.length > 0 ? (
        <Stack spacing={1}>
          {upload.items.map((row) => (
            <UploadRow
              key={row.id}
              row={row}
              onRetry={() => upload.retry(row.id)}
              onRemove={() => upload.remove(row.id)}
            />
          ))}
          <Box sx={{ textAlign: "right" }}>
            <Button size="small" onClick={upload.clear}>
              Clear completed
            </Button>
          </Box>
        </Stack>
      ) : null}
    </Stack>
  );
}

function UploadRow({
  row,
  onRetry,
  onRemove,
}: {
  row: UploadItem;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const status = statusLabel(row);
  const showRetry =
    row.stage === "failed" && row.errorFrom !== null && row.errorFrom !== "precheck";
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5 }}
      data-testid={`upload-row-${row.id}`}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap title={row.filename}>
            {row.filename}
          </Typography>
          <Typography
            variant="caption"
            color={row.stage === "failed" ? "error" : "text.secondary"}
            data-testid={`upload-status-${row.id}`}
          >
            {status}
          </Typography>
          {row.stage === "uploading" ? (
            <LinearProgress
              variant="determinate"
              value={Math.round(row.progress * 100)}
              sx={{ mt: 0.5 }}
              data-testid={`upload-progress-${row.id}`}
            />
          ) : null}
        </Box>
        {showRetry ? (
          <IconButton size="small" onClick={onRetry} aria-label="Retry">
            <ReplayIcon fontSize="small" />
          </IconButton>
        ) : null}
        <IconButton size="small" onClick={onRemove} aria-label="Remove">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
}

function statusLabel(row: UploadItem): string {
  switch (row.stage) {
    case "queued":
    case "checking":
      return "Checking file";
    case "prechecked":
      return "Queued";
    case "requesting":
      return "Requesting upload URL";
    case "uploading":
      return `Uploading ${Math.round(row.progress * 100)}%`;
    case "confirming":
      return "Confirming";
    case "ready":
      return "Ready";
    case "failed":
      return row.error ?? "Failed";
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
