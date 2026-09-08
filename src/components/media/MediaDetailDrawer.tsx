import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { media as mediaApi } from "../../api/resources/media";
import type { MediaAsset, MediaUsage } from "../../api/types";
import { ApiError } from "../../api/errors";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../ConfirmDialog";
import ErrorAlert from "../ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import UsageList from "./UsageList";

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
  const [inUse, setInUse] = useState<MediaUsage | null>(null);

  useEffect(() => {
    if (asset) {
      setAlt(asset.alt ?? "");
      setTitle(asset.title ?? "");
      setInUse(null);
    }
  }, [asset]);

  const usageQ = useQuery({
    queryKey: asset ? keys.mediaUsage(asset.id ?? "") : ["media", "usage", "none"],
    queryFn: () => mediaApi.usage(asset!.id!),
    enabled: !!asset?.id && open,
  });

  const saveMut = useMutation({
    mutationFn: (b: { alt: string; title: string }) =>
      mediaApi.patch(asset!.id!, b),
    onSuccess: () => {
      notify("Saved");
      void qc.invalidateQueries({ queryKey: ["media"] });
    },
    onError: () => notify("Save failed", "error"),
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
    onError: (e) => {
      if (e instanceof ApiError && e.code === "media_in_use") {
        // The API returned the usage document in details.usage; fall back
        // to the current usage query for the same list.
        const details = e.body?.details;
        const usage =
          details && typeof details === "object" && "usage" in details
            ? (details as { usage: unknown }).usage
            : null;
        if (usage && typeof usage === "object") setInUse(usage as MediaUsage);
        else if (usageQ.data) setInUse(usageQ.data);
        setConfirmOpen(false);
      } else {
        notify("Delete failed", "error");
      }
    },
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
            {inUse ? (
              <Alert severity="warning">
                In use by:
                <UsageList usage={inUse} />
              </Alert>
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
          <ConfirmDialog
            open={confirmOpen}
            title="Delete media asset"
            body={`Delete ${asset.filename ?? asset.id}? The file and its variants are removed from the CDN.`}
            confirmLabel="Delete"
            danger
            disabled={deleteMut.isPending}
            onConfirm={() => deleteMut.mutate()}
            onCancel={() => setConfirmOpen(false)}
          />
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
