import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Divider,
  Drawer,
  FormControlLabel,
  FormHelperText,
  IconButton,
  Link,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { media as mediaApi, type MediaKind } from "../../api/resources/media";
import type { MediaAsset } from "../../api/types";
import { keys } from "../../queries/keys";
import DeleteDialog from "../DeleteDialog";
import ErrorAlert from "../ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import UsageList from "./UsageList";
import MediaPicker from "../content/MediaPicker";
import MediaPreview from "../content/MediaPreview";
import { MEDIA_DETAIL_LABELS } from "../content/labels";
import { CREDIT_MAX, creditValue } from "./credit";
import HelpButton from "../../help/HelpButton";
import { formatDuration } from "./duration";

interface Props {
  asset: MediaAsset | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

export default function MediaDetailDrawer({
  asset,
  open,
  onClose,
  onDeleted,
}: Props) {
  const notify = useNotify();
  const qc = useQueryClient();
  const [alt, setAlt] = useState("");
  const [title, setTitle] = useState("");
  const [credit, setCredit] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [darkMediaId, setDarkMediaId] = useState<string | null>(null);
  const [invertInDark, setInvertInDark] = useState(false);
  const [smallMediaId, setSmallMediaId] = useState<string | null>(null);
  const [posterMediaId, setPosterMediaId] = useState<string | null>(null);
  const [picking, setPicking] = useState<"dark" | "small" | "poster" | null>(
    null
  );
  const isVideo = asset?.kind === "video";

  useEffect(() => {
    if (asset) {
      setAlt(asset.alt ?? "");
      setTitle(asset.title ?? "");
      setCredit(asset.credit ?? "");
      setDarkMediaId(asset.darkMediaId ?? null);
      setInvertInDark(asset.invertInDark === true);
      setSmallMediaId(asset.smallMediaId ?? null);
      setPosterMediaId(asset.posterMediaId ?? null);
    }
  }, [asset]);

  // A video's poster, read for the `poster` attribute of the preview.
  const posterQ = useQuery({
    queryKey: keys.mediaAsset(posterMediaId ?? ""),
    queryFn: () => mediaApi.get(posterMediaId!),
    enabled: isVideo && posterMediaId !== null && open,
    staleTime: Infinity,
    retry: false,
  });

  const usageQ = useQuery({
    queryKey: asset ? keys.mediaUsage(asset.id ?? "") : ["media", "usage", "none"],
    queryFn: () => mediaApi.usage(asset!.id!),
    enabled: !!asset?.id && open,
  });

  const saveMut = useMutation({
    mutationFn: (b: { alt: string; title: string; credit: string | null }) =>
      mediaApi.patch(asset!.id!, b),
    onSuccess: (updated, b) => {
      setCredit(
        (updated?.credit !== undefined ? updated.credit : b.credit) ?? ""
      );
      notify("Saved");
      void qc.invalidateQueries({ queryKey: ["media"] });
    },
    onError: () => notify("Save failed", "error"),
  });

  // The dark mode version and the invert switch save as soon as they
  // change; the drawer shows what the API returns.
  const darkMut = useMutation({
    mutationFn: (
      b: { darkMediaId: string | null } | { invertInDark: boolean }
    ) => mediaApi.patch(asset!.id!, b),
    onSuccess: (updated, b) => {
      if ("darkMediaId" in b) {
        setDarkMediaId(updated?.darkMediaId ?? b.darkMediaId);
      } else {
        setInvertInDark(updated?.invertInDark ?? b.invertInDark);
      }
      notify("Saved");
      void qc.invalidateQueries({ queryKey: ["media"] });
    },
  });

  // The small screen version saves as soon as it changes, like the dark
  // mode version.
  const smallMut = useMutation({
    mutationFn: (b: { smallMediaId: string | null }) =>
      mediaApi.patch(asset!.id!, b),
    onSuccess: (updated, b) => {
      setSmallMediaId(updated?.smallMediaId ?? b.smallMediaId);
      notify("Saved");
      void qc.invalidateQueries({ queryKey: ["media"] });
    },
  });

  // A video's poster saves as soon as it changes, like the dark mode
  // version.
  const posterMut = useMutation({
    mutationFn: (b: { posterMediaId: string | null }) =>
      mediaApi.patch(asset!.id!, b),
    onSuccess: (updated, b) => {
      setPosterMediaId(
        updated?.posterMediaId !== undefined
          ? updated.posterMediaId
          : b.posterMediaId
      );
      notify("Saved");
      void qc.invalidateQueries({ queryKey: ["media"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => mediaApi.remove(asset!.id!),
    onSuccess: () => {
      notify("Deleted");
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ["media"] });
      onDeleted?.(asset?.id ?? "");
      onClose();
    },
    onError: () => notify("Delete failed", "error"),
  });

  const handleCopy = (url: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url).then(
        () => notify("URL copied"),
        () => notify("Copy failed", "error")
      );
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 } } }}
    >
      {asset ? (
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ flex: 1, minWidth: 0 }}
            >
              <Typography variant="h6" sx={{ minWidth: 0 }} noWrap>
                {asset.filename ?? asset.id}
              </Typography>
              <HelpButton topic="media.detail" />
            </Stack>
            <IconButton onClick={onClose} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2}>
            <Box
              sx={{
                bgcolor: "action.hover",
                borderRadius: 1,
                p: 1,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {asset.url && isVideo ? (
                <Box
                  component="video"
                  controls
                  preload="metadata"
                  src={asset.url}
                  poster={posterQ.data?.url ?? undefined}
                  sx={{ maxWidth: "100%", maxHeight: 320 }}
                  data-testid="media-video-preview"
                />
              ) : asset.url ? (
                <Box
                  component="img"
                  src={asset.url}
                  alt={asset.alt ?? ""}
                  sx={{ maxWidth: "100%", maxHeight: 320 }}
                />
              ) : null}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {asset.kind ?? "media"} · {asset.state ?? "unknown"}
              {" · "}
              {asset.width ?? "?"} × {asset.height ?? "?"}
              {isVideo && formatDuration(asset.durationMs)
                ? ` · ${formatDuration(asset.durationMs)}`
                : ""}
            </Typography>
            <TextField
              label={MEDIA_DETAIL_LABELS.alt?.label}
              value={alt}
              onChange={(e) => setAlt(e.target.value.slice(0, 500))}
              multiline
              minRows={2}
              inputProps={{ maxLength: 500 }}
              fullWidth
            />
            <TextField
              label={MEDIA_DETAIL_LABELS.title?.label}
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              inputProps={{ maxLength: 200 }}
              fullWidth
            />
            <TextField
              label={MEDIA_DETAIL_LABELS.credit?.label}
              value={credit}
              onChange={(e) => setCredit(e.target.value.slice(0, CREDIT_MAX))}
              helperText={MEDIA_DETAIL_LABELS.credit?.help}
              inputProps={{ maxLength: CREDIT_MAX }}
              fullWidth
            />
            <Box>
              <Button
                variant="contained"
                onClick={() =>
                  saveMut.mutate({ alt, title, credit: creditValue(credit) })
                }
                disabled={saveMut.isPending}
              >
                Save
              </Button>
              {saveMut.error ? (
                <Box sx={{ mt: 1 }}>
                  <ErrorAlert error={saveMut.error} />
                </Box>
              ) : null}
            </Box>
            <Divider />
            {isVideo ? (
              <Stack spacing={1} data-testid="media-poster">
                <Typography variant="subtitle2">Poster image</Typography>
                {posterMediaId ? (
                  <MediaPreview mediaId={posterMediaId} />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    None
                  </Typography>
                )}
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setPicking("poster")}
                    disabled={posterMut.isPending}
                  >
                    Choose
                  </Button>
                  <Button
                    size="small"
                    onClick={() => posterMut.mutate({ posterMediaId: null })}
                    disabled={posterMut.isPending || !posterMediaId}
                  >
                    Clear
                  </Button>
                </Stack>
                <FormHelperText sx={{ mt: 0 }}>
                  Shown before the video plays. Pick any picture.
                </FormHelperText>
                {posterMut.error ? <ErrorAlert error={posterMut.error} /> : null}
              </Stack>
            ) : null}
            {isVideo ? null : (
              <>
                <Stack spacing={1} data-testid="media-dark-mode">
                  <Typography variant="subtitle2">Dark mode</Typography>
                  <Typography variant="body2">Dark mode version</Typography>
                  {darkMediaId ? (
                    <MediaPreview mediaId={darkMediaId} />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      None
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setPicking("dark")}
                      disabled={darkMut.isPending}
                    >
                      Choose
                    </Button>
                    <Button
                      size="small"
                      onClick={() => darkMut.mutate({ darkMediaId: null })}
                      disabled={darkMut.isPending || !darkMediaId}
                    >
                      Clear
                    </Button>
                  </Stack>
                  <Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={invertInDark}
                          onChange={(e) =>
                            darkMut.mutate({ invertInDark: e.target.checked })
                          }
                          disabled={darkMut.isPending}
                        />
                      }
                      label="Invert in dark mode"
                    />
                    <FormHelperText sx={{ mt: 0 }}>
                      For one-colour images: flips the colours when the site is
                      dark. Ignored when a dark version is set.
                    </FormHelperText>
                  </Box>
                  {darkMut.error ? <ErrorAlert error={darkMut.error} /> : null}
                </Stack>
                <Stack spacing={1} data-testid="media-small-screen">
                  <Typography variant="body2">Small screen version</Typography>
                  {smallMediaId ? (
                    <MediaPreview mediaId={smallMediaId} />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      None
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setPicking("small")}
                      disabled={smallMut.isPending}
                    >
                      Choose
                    </Button>
                    <Button
                      size="small"
                      onClick={() => smallMut.mutate({ smallMediaId: null })}
                      disabled={smallMut.isPending || !smallMediaId}
                    >
                      Clear
                    </Button>
                  </Stack>
                  <FormHelperText sx={{ mt: 0 }}>
                    {"Drawn in this image's place on screens under 760 px wide."}
                  </FormHelperText>
                  {smallMut.error ? <ErrorAlert error={smallMut.error} /> : null}
                </Stack>
              </>
            )}
            <Divider />
            <Stack spacing={1}>
              <Typography variant="subtitle2">Variants</Typography>
              {asset.url ? (
                <VariantRow label="original" url={asset.url} onCopy={handleCopy} />
              ) : null}
              {Object.entries(asset.variants ?? {}).map(([w, url]) => (
                <VariantRow
                  key={w}
                  label={`${w}px`}
                  url={url}
                  onCopy={handleCopy}
                />
              ))}
              {typeof asset.dziUrl === "string" && asset.dziUrl.length > 0 ? (
                <VariantRow
                  label="deep zoom"
                  url={asset.dziUrl}
                  onCopy={handleCopy}
                />
              ) : null}
            </Stack>
            <Divider />
            <Typography variant="subtitle2">Usage</Typography>
            {usageQ.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            ) : usageQ.data ? (
              <UsageList usage={usageQ.data} />
            ) : null}
            <Divider />
            <Box>
              <Button
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setConfirmOpen(true)}
                disabled={deleteMut.isPending}
              >
                Delete
              </Button>
            </Box>
          </Stack>
          <MediaPicker
            open={picking !== null}
            title={
              picking === "poster"
                ? "Choose the poster image"
                : picking === "small"
                  ? "Choose the small screen version"
                  : "Choose the dark mode version"
            }
            kinds={picking === "poster" ? POSTER_KINDS : undefined}
            excludeIds={asset.id ? [asset.id] : []}
            onCancel={() => setPicking(null)}
            onPick={(picked) => {
              const target = picking;
              setPicking(null);
              if (!picked.id || picked.id === asset.id) return;
              if (target === "poster") {
                posterMut.mutate({ posterMediaId: picked.id });
              } else if (target === "small") {
                smallMut.mutate({ smallMediaId: picked.id });
              } else {
                darkMut.mutate({ darkMediaId: picked.id });
              }
            }}
          />
          {confirmOpen && asset.id ? (
            <DeleteDialog
              open
              resource="media"
              id={asset.id}
              name={asset.filename ?? asset.id}
              disabled={deleteMut.isPending}
              onConfirm={() => deleteMut.mutate()}
              onCancel={() => setConfirmOpen(false)}
            />
          ) : null}
        </Box>
      ) : null}
    </Drawer>
  );
}

// A poster is a raster or gif picture (contracts 4.5 Media).
const POSTER_KINDS: MediaKind[] = ["raster", "gif"];

function VariantRow({
  label,
  url,
  onCopy,
}: {
  label: string;
  url: string;
  onCopy: (url: string) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        variant="body2"
        sx={{ flex: 1, wordBreak: "break-all" }}
      >
        {label}
      </Link>
      <IconButton
        size="small"
        onClick={() => onCopy(url)}
        aria-label={`Copy ${label} URL`}
      >
        <ContentCopyIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
