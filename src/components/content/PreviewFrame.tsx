import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMutation, useQuery } from "@tanstack/react-query";
import { content as contentApi } from "../../api/resources/content";
import { pages as pagesApi } from "../../api/resources/pages";
import { keys } from "../../queries/keys";
import ErrorAlert from "../ErrorAlert";
import type { PreviewToken } from "../../api/types";

type Device = "phone" | "tablet" | "desktop";

const DEVICE_WIDTH: Record<Device, number> = {
  phone: 375,
  tablet: 768,
  desktop: 1200,
};

interface Props {
  open: boolean;
  onClose: () => void;
  // Slug of the page to preview; when undefined the frame shows "/".
  initialSlug?: string | null;
  // Show the page selector? Defaults to true.
  showPageSelector?: boolean;
  title?: string;
}

// Frame the preview site with a minted token (admin.md 6.17). The
// dialog holds an iframe, a countdown for the token's remaining time,
// a device toggle, a page selector, and a Reload/Refresh token button.
export default function PreviewFrame({
  open,
  onClose,
  initialSlug = null,
  showPageSelector = true,
  title = "Preview",
}: Props) {
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [device, setDevice] = useState<Device>("desktop");
  const [token, setToken] = useState<PreviewToken | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [reloadNonce, setReloadNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (open) setSlug(initialSlug);
  }, [open, initialSlug]);

  const mintMut = useMutation({
    mutationFn: () => contentApi.previewToken(),
    onSuccess: (t) => setToken(t),
  });
  // Latest mutation exposed to the open/close effect through a ref so
  // that its unstable identity does not re-fire the effect.
  const mintMutRef = useRef(mintMut);
  mintMutRef.current = mintMut;

  // Mint a token when the dialog opens (and only once until close).
  const openedRef = useRef(false);
  useEffect(() => {
    if (open && !openedRef.current) {
      openedRef.current = true;
      setToken(null);
      mintMutRef.current.mutate();
    }
    if (!open) {
      openedRef.current = false;
      setToken(null);
      mintMutRef.current.reset();
    }
  }, [open]);

  const pagesQ = useQuery({
    queryKey: keys.pages,
    queryFn: () => pagesApi.list(),
    enabled: open && showPageSelector,
  });

  // 1 s countdown tick while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const src = useMemo(() => {
    if (!token?.url) return "";
    try {
      const u = new URL(token.url);
      if (slug) u.searchParams.set("page", slug);
      // Include a nonce so React will unmount/remount the iframe when a
      // reload is requested even when the URL is otherwise unchanged.
      if (reloadNonce > 0) u.searchParams.set("r", String(reloadNonce));
      return u.toString();
    } catch {
      const joiner = token.url.includes("?") ? "&" : "?";
      const withSlug = slug ? `${token.url}${joiner}page=${encodeURIComponent(slug)}` : token.url;
      return reloadNonce > 0
        ? `${withSlug}${withSlug.includes("?") ? "&" : "?"}r=${reloadNonce}`
        : withSlug;
    }
  }, [token, slug, reloadNonce]);

  const remainingMs = useMemo(() => {
    if (!token?.expiresAt) return 0;
    const t = new Date(token.expiresAt).getTime();
    if (Number.isNaN(t)) return 0;
    return Math.max(0, t - nowMs);
  }, [token, nowMs]);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const expired = token !== null && remainingMs === 0;

  const reload = () => {
    if (expired) {
      mintMut.mutate();
      return;
    }
    setReloadNonce((n) => n + 1);
  };

  const mintNewToken = () => {
    mintMut.mutate();
    setReloadNonce((n) => n + 1);
  };

  const pageItems = pagesQ.data?.items ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{ sx: { width: "min(1400px, 96vw)", height: "min(900px, 90vh)" } }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          <IconButton
            aria-label="Reload preview"
            onClick={reload}
            data-testid="preview-reload"
          >
            <RefreshIcon />
          </IconButton>
          <IconButton
            aria-label="Close preview"
            onClick={onClose}
            data-testid="preview-close"
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ mb: 2 }}
        >
          {showPageSelector ? (
            <TextField
              select
              size="small"
              label="Page"
              value={slug ?? ""}
              onChange={(e) => setSlug(e.target.value === "" ? null : e.target.value)}
              sx={{ minWidth: 200 }}
              data-testid="preview-page-select"
            >
              <MenuItem value="">Home</MenuItem>
              {slug && !pageItems.some((p) => (p.slug ?? "") === slug) ? (
                <MenuItem value={slug}>{slug}</MenuItem>
              ) : null}
              {pageItems.map((p) => (
                <MenuItem key={String(p.id)} value={p.slug ?? ""}>
                  {p.title} (/{p.slug})
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField
            select
            size="small"
            label="Device"
            value={device}
            onChange={(e) => setDevice(e.target.value as Device)}
            sx={{ minWidth: 140 }}
            data-testid="preview-device-select"
          >
            <MenuItem value="phone">Phone</MenuItem>
            <MenuItem value="tablet">Tablet</MenuItem>
            <MenuItem value="desktop">Desktop</MenuItem>
          </TextField>
          <Box sx={{ flexGrow: 1 }} />
          {token ? (
            <Typography
              variant="caption"
              color={expired ? "error.main" : "text.secondary"}
              data-testid="preview-countdown"
            >
              {expired
                ? "Token expired"
                : `Token expires in ${remainingMinutes} min`}
            </Typography>
          ) : null}
          <Button size="small" onClick={mintNewToken} data-testid="preview-new-token">
            New token
          </Button>
        </Stack>
        {mintMut.error ? <ErrorAlert error={mintMut.error} /> : null}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            width: "100%",
            height: "calc(100% - 80px)",
            backgroundColor: "background.default",
          }}
        >
          {!token ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
              Minting preview token…
            </Typography>
          ) : (
            <Box
              sx={{
                width: DEVICE_WIDTH[device],
                maxWidth: "100%",
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.paper",
              }}
            >
              <iframe
                ref={iframeRef}
                title={title}
                src={src}
                data-testid="preview-iframe"
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
