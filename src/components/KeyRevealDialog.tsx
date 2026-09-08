import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { Enrollment } from "../api/types";
import { useNow } from "../hooks/useNow";
import { useNotify } from "../hooks/useNotify";

interface Props {
  open: boolean;
  title: string;
  beaconKey: string;
  enrollment: Enrollment;
  onClose: () => void;
}

// admin.md 6.5: after create and after rotate. No backdrop close, no
// escape close. The only button is "I have stored the key".
export default function KeyRevealDialog({
  open,
  title,
  beaconKey,
  enrollment,
  onClose,
}: Props) {
  const notify = useNotify();
  const now = useNow(1000);

  const expiresAt = enrollment.expiresAt ?? "";
  const remainingS = useMemo(() => {
    if (!expiresAt) return null;
    const t = Date.parse(expiresAt);
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((t - now) / 1000));
  }, [expiresAt, now]);

  const countdownLabel = useMemo(() => {
    if (remainingS === null) return "QR expiry unknown";
    if (remainingS <= 0) {
      return "QR expired. The key still works when typed by hand; rotate to mint a new QR";
    }
    const m = Math.floor(remainingS / 60);
    const s = remainingS % 60;
    return `QR valid for ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remainingS]);

  const [copied, setCopied] = useState<"key" | "url" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 1200);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async (kind: "key" | "url", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      notify(kind === "key" ? "Key copied" : "Enrolment URL copied");
    } catch {
      notify("Copy failed", "error");
    }
  };

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      onClose={(_e, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        onClose();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="warning">
            This key is shown once. Store it before closing.
          </Alert>
          <TextField
            label="Key"
            value={beaconKey}
            fullWidth
            InputProps={{
              readOnly: true,
              sx: { fontFamily: "Menlo, Monaco, Consolas, monospace" },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    aria-label="Copy key"
                    onClick={() => void copy("key", beaconKey)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText={copied === "key" ? "Copied" : ""}
          />
          {enrollment.qrPngDataUrl ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                p: 2,
                backgroundColor: "background.paper",
              }}
            >
              <Box
                component="img"
                src={enrollment.qrPngDataUrl}
                alt="Enrolment QR code"
                sx={{
                  width: 220,
                  height: 220,
                  imageRendering: "pixelated",
                }}
              />
            </Box>
          ) : null}
          <TextField
            label="Enrolment URL"
            value={enrollment.url ?? ""}
            fullWidth
            InputProps={{
              readOnly: true,
              sx: { fontFamily: "Menlo, Monaco, Consolas, monospace" },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    aria-label="Copy enrolment URL"
                    onClick={() => void copy("url", enrollment.url ?? "")}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText={copied === "url" ? "Copied" : ""}
          />
          <Typography
            variant="body2"
            color={remainingS !== null && remainingS <= 0 ? "error" : "text.secondary"}
          >
            {countdownLabel}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          I have stored the key
        </Button>
      </DialogActions>
    </Dialog>
  );
}
