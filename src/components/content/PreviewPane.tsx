import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMutation, useQuery } from "@tanstack/react-query";
import { content as contentApi } from "../../api/resources/content";
import { pages as pagesApi } from "../../api/resources/pages";
import { keys } from "../../queries/keys";
import ErrorAlert from "../ErrorAlert";
import { useCompact } from "../../hooks/useCompact";
import type { PreviewToken } from "../../api/types";

export type PreviewDevice = "phone" | "tablet" | "desktop";
export type PreviewTheme = "site" | "light" | "dark";

const DEVICE_WIDTH: Record<PreviewDevice, number> = {
  phone: 375,
  tablet: 768,
  desktop: 1200,
};

// Delay between a reload request through `reloadSignal` and the reload.
export const AUTO_RELOAD_DEBOUNCE_MS = 1500;

interface Props {
  // Mints a token while true; clears it when false.
  active: boolean;
  // Slug of the page to preview; when null the frame shows "/".
  initialSlug?: string | null;
  // Show the page selector? Defaults to true.
  showPageSelector?: boolean;
  // Accessible title of the iframe.
  title?: string;
  defaultDevice?: PreviewDevice;
  // Each change to a non-zero value schedules one reload after
  // AUTO_RELOAD_DEBOUNCE_MS; further changes inside that window restart it.
  reloadSignal?: number;
}

// Build the frame URL from the token URL plus page, theme, and reload nonce.
function buildSrc(
  base: string,
  slug: string | null,
  theme: PreviewTheme,
  nonce: number
): string {
  const params: [string, string][] = [];
  if (slug) params.push(["page", slug]);
  if (theme !== "site") params.push(["theme", theme]);
  // The nonce changes the URL so the frame reloads even when the page and
  // theme are unchanged.
  if (nonce > 0) params.push(["r", String(nonce)]);
  try {
    const u = new URL(base);
    for (const [k, v] of params) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    let out = base;
    for (const [k, v] of params) {
      out += `${out.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}`;
    }
    return out;
  }
}

// The preview site framed with a minted token (admin.md 6.17): a toolbar
// (page select, device select, Light / Dark / Site default theme toggle,
// token countdown, New token, Reload) over an iframe that fills the rest
// of the pane's height. The parent gives the pane its size.
export default function PreviewPane({
  active,
  initialSlug = null,
  showPageSelector = true,
  title = "Preview",
  defaultDevice = "desktop",
  reloadSignal = 0,
}: Props) {
  const compact = useCompact();
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [device, setDevice] = useState<PreviewDevice>(defaultDevice);
  const [theme, setTheme] = useState<PreviewTheme>("site");
  const [token, setToken] = useState<PreviewToken | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (active) setSlug(initialSlug);
  }, [active, initialSlug]);

  const mintMut = useMutation({
    mutationFn: () => contentApi.previewToken(),
    onSuccess: (t) => setToken(t),
  });
  // Latest mutation exposed to the effects through a ref so that its
  // unstable identity does not re-fire them.
  const mintMutRef = useRef(mintMut);
  mintMutRef.current = mintMut;

  // Mint a token when the pane becomes active (and only once until it is
  // inactive again).
  const activeRef = useRef(false);
  useEffect(() => {
    if (active && !activeRef.current) {
      activeRef.current = true;
      setToken(null);
      mintMutRef.current.mutate();
    }
    if (!active) {
      activeRef.current = false;
      setToken(null);
      mintMutRef.current.reset();
    }
  }, [active]);

  const pagesQ = useQuery({
    queryKey: keys.pages,
    queryFn: () => pagesApi.list(),
    enabled: active && showPageSelector,
  });

  // 1 s countdown tick while the pane is active.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const src = useMemo(
    () => (token?.url ? buildSrc(token.url, slug, theme, reloadNonce) : ""),
    [token, slug, theme, reloadNonce]
  );

  const remainingMs = useMemo(() => {
    if (!token?.expiresAt) return 0;
    const t = new Date(token.expiresAt).getTime();
    if (Number.isNaN(t)) return 0;
    return Math.max(0, t - nowMs);
  }, [token, nowMs]);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const expired = token !== null && remainingMs === 0;

  // Reload keeps the iframe mounted and changes its URL, so the pane's
  // layout (and the page around it) does not jump. The frame is another
  // origin, so its own scroll position is not read.
  const reload = () => {
    if (expired) {
      mintMut.mutate();
      return;
    }
    setReloadNonce((n) => n + 1);
  };
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!active || reloadSignal === 0) return;
    const t = setTimeout(() => reloadRef.current(), AUTO_RELOAD_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [active, reloadSignal]);

  const mintNewToken = () => {
    mintMut.mutate();
    setReloadNonce((n) => n + 1);
  };

  const pageItems = pagesQ.data?.items ?? [];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
      data-testid="preview-pane"
    >
      <Stack
        direction="row"
        spacing={compact ? 1 : 2}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: compact ? 1 : 2 }}
      >
        {showPageSelector ? (
          <TextField
            select
            size="small"
            label="Page"
            value={slug ?? ""}
            onChange={(e) => setSlug(e.target.value === "" ? null : e.target.value)}
            sx={{ minWidth: { xs: "auto", sm: 200 }, flex: { xs: 1, sm: "0 0 auto" } }}
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
        {compact ? null : (
          <TextField
            select
            size="small"
            label="Device"
            value={device}
            onChange={(e) => setDevice(e.target.value as PreviewDevice)}
            sx={{ minWidth: { xs: "100%", sm: 140 } }}
            data-testid="preview-device-select"
          >
            <MenuItem value="phone">Phone</MenuItem>
            <MenuItem value="tablet">Tablet</MenuItem>
            <MenuItem value="desktop">Desktop</MenuItem>
          </TextField>
        )}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={theme}
          onChange={(_e, v: PreviewTheme | null) => {
            if (v) setTheme(v);
          }}
          aria-label="Preview theme"
          data-testid="preview-theme-toggle"
        >
          <ToggleButton value="light">Light</ToggleButton>
          <ToggleButton value="dark">Dark</ToggleButton>
          <ToggleButton value="site">Site default</ToggleButton>
        </ToggleButtonGroup>
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
        <Tooltip title="Reload preview">
          <IconButton
            aria-label="Reload preview"
            onClick={reload}
            data-testid="preview-reload"
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      {mintMut.error ? <ErrorAlert error={mintMut.error} /> : null}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          width: "100%",
          flex: 1,
          minHeight: 0,
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
              width: compact ? "100%" : `min(${DEVICE_WIDTH[device]}px, 100%)`,
              maxWidth: "100%",
              border: compact ? 0 : "1px solid",
              borderColor: "divider",
              backgroundColor: "background.paper",
            }}
          >
            <iframe
              title={title}
              src={src}
              data-testid="preview-iframe"
              style={{ width: "100%", height: "100%", border: 0, display: "block" }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
