import { useRef, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useMutation } from "@tanstack/react-query";
import { content as contentApi } from "../../api/resources/content";
import ErrorAlert from "../ErrorAlert";
import { useNotify } from "../../hooks/useNotify";

// localStorage key holding the chosen link lifetime in minutes.
const SHARE_TTL_KEY = "previewShareTtlMinutes";

const SHARE_TTL_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 480, label: "8 hours" },
  { minutes: 1440, label: "24 hours" },
];

const DEFAULT_SHARE_TTL = 480;

function readTtl(): number {
  try {
    const n = Number(localStorage.getItem(SHARE_TTL_KEY));
    return SHARE_TTL_OPTIONS.some((o) => o.minutes === n) ? n : DEFAULT_SHARE_TTL;
  } catch {
    return DEFAULT_SHARE_TTL;
  }
}

function writeTtl(minutes: number): void {
  try {
    localStorage.setItem(SHARE_TTL_KEY, String(minutes));
  } catch {
    // Storage blocked; the choice lasts until the pane unmounts.
  }
}

// Local time of the expiry; the date is added when it falls on another day.
function formatExpiry(expiresAt: string | undefined): string {
  const d = expiresAt ? new Date(expiresAt) : null;
  if (!d || Number.isNaN(d.getTime())) return "unknown";
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? time
    : `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}

interface Props {
  // Builds the site URL for a token URL with the pane's page and theme.
  buildUrl: (tokenUrl: string) => string;
}

type Action = "open" | "copy";

// The Share button of the preview toolbar (admin.md 6.17): a popover with
// a "Link lasts" select, "Open in new window", and "Copy link". Each action
// mints its own token with the chosen lifetime; the pane's own token is
// untouched. When the clipboard is unavailable the URL shows in a read-only
// field with a Select button.
export default function PreviewShare({ buildUrl }: Props) {
  const notify = useNotify();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [ttl, setTtl] = useState<number>(readTtl);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLInputElement | null>(null);

  const mintMut = useMutation({
    mutationFn: async (action: Action) => ({
      action,
      token: await contentApi.previewToken(ttl),
    }),
    onSuccess: async ({ action, token }) => {
      const url = buildUrl(token.url ?? "");
      if (action === "open") {
        window.open(url, "_blank", "noopener");
        return;
      }
      const until = formatExpiry(token.expiresAt);
      try {
        if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
        await navigator.clipboard.writeText(url);
        setFallbackUrl(null);
        notify(`Link copied, valid until ${until}`);
      } catch {
        setFallbackUrl(url);
      }
    },
  });

  const onTtlChange = (minutes: number) => {
    setTtl(minutes);
    writeTtl(minutes);
  };

  const selectFallback = () => {
    fallbackRef.current?.focus();
    fallbackRef.current?.select();
  };

  return (
    <>
      <Button
        size="small"
        startIcon={<ShareIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        data-testid="preview-share"
      >
        Share
      </Button>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { p: 2, width: 340, maxWidth: "calc(100vw - 32px)" },
            "data-testid": "preview-share-menu",
          } as object,
        }}
      >
        <Stack spacing={1.5}>
          <TextField
            select
            size="small"
            label="Link lasts"
            value={ttl}
            onChange={(e) => onTtlChange(Number(e.target.value))}
            data-testid="preview-share-ttl"
          >
            {SHARE_TTL_OPTIONS.map((o) => (
              <MenuItem key={o.minutes} value={o.minutes}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            disabled={mintMut.isPending}
            onClick={() => mintMut.mutate("open")}
            data-testid="preview-share-open"
          >
            Open in new window
          </Button>
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            disabled={mintMut.isPending}
            onClick={() => mintMut.mutate("copy")}
            data-testid="preview-share-copy"
          >
            Copy link
          </Button>
          {fallbackUrl ? (
            <Box data-testid="preview-share-fallback">
              <Typography variant="body2" sx={{ mb: 1 }}>
                Copy this link:
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  fullWidth
                  value={fallbackUrl}
                  inputRef={fallbackRef}
                  onFocus={(e) => e.target.select()}
                  slotProps={{
                    htmlInput: {
                      readOnly: true,
                      "aria-label": "Preview link",
                      "data-testid": "preview-share-url",
                    },
                  }}
                />
                <Button onClick={selectFallback} data-testid="preview-share-select">
                  Select
                </Button>
              </Stack>
            </Box>
          ) : null}
          {mintMut.error ? <ErrorAlert error={mintMut.error} /> : null}
          <Typography variant="caption" color="text.secondary">
            The link follows your draft live while it is open.
          </Typography>
        </Stack>
      </Popover>
    </>
  );
}
