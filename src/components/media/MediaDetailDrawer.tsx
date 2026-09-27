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
import { media as mediaApi } from "../../api/resources/media";
import { events as eventsApi } from "../../api/resources/events";
import type { Event, MediaAsset } from "../../api/types";
import { keys } from "../../queries/keys";
import DeleteDialog from "../DeleteDialog";
import ErrorAlert from "../ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import UsageList from "./UsageList";
import MediaPicker from "../content/MediaPicker";
import MediaPreview from "../content/MediaPreview";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [darkMediaId, setDarkMediaId] = useState<string | null>(null);
  const [invertInDark, setInvertInDark] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (asset) {
      setAlt(asset.alt ?? "");
      setTitle(asset.title ?? "");
      setDarkMediaId(asset.darkMediaId ?? null);
      setInvertInDark(asset.invertInDark === true);
    }
  }, [asset]);

  const usageQ = useQuery({
    queryKey: asset ? keys.mediaUsage(asset.id ?? "") : ["media", "usage", "none"],
    queryFn: () => mediaApi.usage(asset!.id!),
    enabled: !!asset?.id && open,
  });

  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
    enabled: open,
  });

  const posterEvents: Event[] = asset?.id
    ? (eventsQ.data?.items ?? []).filter(
        (e) => e.routeImageMediaId === asset.id
      )
    : [];

  const saveMut = useMutation({
    mutationFn: (b: { alt: string; title: string }) =>
      mediaApi.patch(asset!.id!, b),
    onSuccess: () => {
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
            <Typography variant="h6" sx={{ flex: 1 }} noWrap>
              {asset.filename ?? asset.id}
            </Typography>
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
              {asset.url ? (
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
            </Typography>
            <TextField
              label="Alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value.slice(0, 500))}
              multiline
              minRows={2}
              inputProps={{ maxLength: 500 }}
              fullWidth
            />
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              inputProps={{ maxLength: 200 }}
              fullWidth
            />
            <Box>
              <Button
                variant="contained"
                onClick={() => saveMut.mutate({ alt, title })}
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
                  onClick={() => setPickerOpen(true)}
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
              <UsageList usage={usageQ.data} posterEvents={posterEvents} />
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
            open={pickerOpen}
            title="Choose the dark mode version"
            excludeIds={asset.id ? [asset.id] : []}
            onCancel={() => setPickerOpen(false)}
            onPick={(picked) => {
              setPickerOpen(false);
              if (!picked.id || picked.id === asset.id) return;
              darkMut.mutate({ darkMediaId: picked.id });
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
