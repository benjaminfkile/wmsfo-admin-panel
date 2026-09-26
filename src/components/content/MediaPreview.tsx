import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { media as mediaApi } from "../../api/resources/media";
import { keys } from "../../queries/keys";
import type { MediaAsset } from "../../api/types";

interface Props {
  mediaId: string;
}

// Renders the media asset for a MediaRef as a thumbnail with its
// filename and dimensions under it. Smallest variant when present,
// otherwise `url`; a missing asset shows a "Missing" placeholder box
// with the id in a tooltip.
export default function MediaPreview({ mediaId }: Props) {
  const enabled = typeof mediaId === "string" && mediaId.length > 0;
  const q = useQuery({
    queryKey: keys.mediaAsset(mediaId),
    queryFn: () => mediaApi.get(mediaId),
    enabled,
    staleTime: Infinity,
    retry: false,
  });

  if (!enabled) {
    return (
      <Typography variant="body2" color="text.secondary" data-testid="media-preview-empty">
        No media
      </Typography>
    );
  }

  if (q.isLoading) {
    return (
      <Box
        sx={{
          height: 96,
          width: 96,
          bgcolor: "action.hover",
          borderRadius: 0.5,
        }}
        aria-label="Loading media"
      />
    );
  }

  const asset = q.data as MediaAsset | undefined;
  const src = asset ? smallestVariantUrl(asset) ?? (asset.url ?? null) : null;

  if (!asset || !src) {
    return (
      <Tooltip title={mediaId}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 96,
            minWidth: 96,
            border: 1,
            borderColor: "warning.main",
            color: "warning.main",
            borderRadius: 0.5,
            px: 1,
          }}
          data-testid="media-preview-missing"
        >
          Missing
        </Box>
      </Tooltip>
    );
  }

  const dims =
    typeof asset.width === "number" && typeof asset.height === "number"
      ? `${asset.width} x ${asset.height}`
      : null;
  const filename = asset.filename ?? mediaId;

  return (
    <Stack spacing={0.5} data-testid="media-preview">
      <Box
        component="img"
        src={src}
        alt={asset.alt ?? filename}
        sx={{
          height: 96,
          maxWidth: "100%",
          objectFit: "contain",
          display: "block",
        }}
        data-testid="media-preview-image"
      />
      <Typography variant="caption" sx={{ wordBreak: "break-all" }}>
        {filename}
      </Typography>
      {dims ? (
        <Typography variant="caption" color="text.secondary">
          {dims}
        </Typography>
      ) : null}
    </Stack>
  );
}

function smallestVariantUrl(asset: MediaAsset): string | null {
  const variants = asset.variants;
  if (!variants) return null;
  const entries = Object.entries(variants).filter(
    ([, url]) => typeof url === "string" && url.length > 0
  );
  if (entries.length === 0) return null;
  entries.sort(([a], [b]) => {
    const na = Number(a);
    const nb = Number(b);
    const va = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY;
    const vb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY;
    return va - vb;
  });
  return entries[0]![1] as string;
}
