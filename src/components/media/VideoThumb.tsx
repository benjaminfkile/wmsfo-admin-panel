import { Box } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useQuery } from "@tanstack/react-query";
import { media as mediaApi } from "../../api/resources/media";
import { keys } from "../../queries/keys";
import type { MediaAsset } from "../../api/types";

interface Props {
  asset: MediaAsset;
  // "480" draws the poster's 480 px variant (the grid card); "smallest"
  // its smallest variant (MediaPreview). Either falls back to the
  // poster's original.
  variant?: "480" | "smallest";
  // CSS height of the box; the card fills its square instead.
  height?: number | string;
}

// A video's still: its poster image when `posterMediaId` is set,
// otherwise a neutral placeholder. A play glyph sits over either, so the
// panel never plays a video in a card or a preview.
export default function VideoThumb({ asset, variant = "480", height = "100%" }: Props) {
  const posterId =
    typeof asset.posterMediaId === "string" && asset.posterMediaId.length > 0
      ? asset.posterMediaId
      : null;
  const q = useQuery({
    queryKey: keys.mediaAsset(posterId ?? ""),
    queryFn: () => mediaApi.get(posterId!),
    enabled: posterId !== null,
    staleTime: Infinity,
    retry: false,
  });
  const src = q.data ? posterUrl(q.data, variant) : null;
  return (
    <Box
      sx={{
        position: "relative",
        height,
        width: "100%",
        minWidth: 96,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: src ? undefined : "action.selected",
        borderRadius: 0.5,
        overflow: "hidden",
      }}
      data-testid={src ? "video-thumb-poster" : "video-thumb-placeholder"}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={asset.alt ?? asset.filename ?? ""}
          sx={{
            maxHeight: "100%",
            maxWidth: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      ) : null}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          borderRadius: "50%",
          bgcolor: "rgba(0, 0, 0, 0.55)",
          color: "#fff",
          p: 0.5,
        }}
        aria-label="Video"
        role="img"
        data-testid="video-play-glyph"
      >
        <PlayArrowIcon />
      </Box>
    </Box>
  );
}

function posterUrl(poster: MediaAsset, variant: "480" | "smallest"): string | null {
  const variants = Object.entries(poster.variants ?? {}).filter(
    ([, url]) => typeof url === "string" && url.length > 0
  );
  if (variant === "480") {
    const v480 = variants.find(([w]) => w === "480");
    if (v480) return v480[1] as string;
  } else if (variants.length > 0) {
    variants.sort(([a], [b]) => Number(a) - Number(b));
    return variants[0]![1] as string;
  }
  return typeof poster.url === "string" && poster.url.length > 0
    ? poster.url
    : null;
}
