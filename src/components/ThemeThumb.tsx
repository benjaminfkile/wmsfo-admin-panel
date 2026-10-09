import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { media as mediaApi } from "../api/resources/media";
import type { TrackerTheme } from "../api/types";
import { keys } from "../queries/keys";

// A theme's thumbnail: the `480` variant of its media asset at `size` px
// (48 by default), or a swatch of its chrome `bg` and `accent` when it
// has none.
export default function ThemeThumb({ theme, size = 48 }: { theme: TrackerTheme; size?: number }) {
  const mediaId = theme.thumbnailMediaId ?? "";
  const q = useQuery({
    queryKey: keys.mediaAsset(mediaId),
    queryFn: () => mediaApi.get(mediaId),
    enabled: mediaId !== "",
    staleTime: Infinity,
    retry: false,
  });
  const v480 = q.data?.variants?.["480"];
  const src = typeof v480 === "string" && v480 !== "" ? v480 : q.data?.url;
  if (mediaId !== "" && src) {
    return (
      <Box
        component="img"
        src={src}
        alt=""
        data-testid={`theme-thumb-${String(theme.id)}`}
        sx={{ width: size, height: size, objectFit: "cover", borderRadius: 0.5, flexShrink: 0 }}
      />
    );
  }
  return (
    <Box
      data-testid={`theme-swatch-${String(theme.id)}`}
      sx={{
        width: size,
        height: size,
        borderRadius: 0.5,
        flexShrink: 0,
        border: 1,
        borderColor: "divider",
        background: `linear-gradient(135deg, ${theme.chrome?.bg ?? "#ffffff"} 50%, ${
          theme.chrome?.accent ?? "#000000"
        } 50%)`,
      }}
    />
  );
}
