import { Box, Tooltip } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { icons as iconsApi } from "../../api/resources/icons";
import { media as mediaApi } from "../../api/resources/media";
import { keys } from "../../queries/keys";
import type { Icon, IconInfo, MediaAsset } from "../../api/types";

interface Props {
  icon: Icon;
  size?: number;
}

// Renders the picked Icon as its image: a library icon by url from the
// shared icons list, a media icon by its smallest variant (fallback to
// its url). A missing asset renders a "Missing" placeholder box; the
// tooltip carries the id.
export default function IconPreview({ icon, size = 32 }: Props) {
  const isLibrary = icon.source === "library";
  const isMedia = icon.source === "media";

  const iconsQ = useQuery({
    queryKey: keys.icons,
    queryFn: () => iconsApi.list(),
    enabled: isLibrary,
    staleTime: Infinity,
  });

  const mediaQ = useQuery({
    queryKey: keys.mediaAsset(String(icon.id ?? "")),
    queryFn: () => mediaApi.get(String(icon.id ?? "")),
    enabled: isMedia && typeof icon.id === "string" && icon.id.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  let src: string | null = null;
  let loading = false;
  let alt = String(icon.id ?? "");

  if (isLibrary) {
    if (iconsQ.isLoading) loading = true;
    const info = (iconsQ.data?.items ?? []).find(
      (i: IconInfo) => i.id === icon.id
    );
    if (info?.url && typeof info.url === "string") src = info.url;
    if (info?.name) alt = info.name;
  } else if (isMedia) {
    if (mediaQ.isLoading) loading = true;
    const asset = mediaQ.data as MediaAsset | undefined;
    if (asset) {
      src = smallestVariantUrl(asset) ?? (asset.url ?? null);
      if (asset.alt) alt = asset.alt;
      else if (asset.filename) alt = asset.filename;
    }
  }

  if (loading) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          bgcolor: "action.hover",
          borderRadius: 0.5,
          flexShrink: 0,
        }}
        aria-label="Loading icon"
      />
    );
  }

  if (!src) {
    return (
      <Tooltip title={String(icon.id ?? "")}>
        <Box
          sx={{
            width: size,
            height: size,
            border: 1,
            borderColor: "warning.main",
            borderRadius: 0.5,
            color: "warning.main",
            fontSize: Math.max(9, Math.floor(size / 4)),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            flexShrink: 0,
          }}
          data-testid="icon-preview-missing"
        >
          Missing
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
      }}
      data-testid="icon-preview-image"
    />
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
