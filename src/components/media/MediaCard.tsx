import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import type { MediaAsset } from "../../api/types";

interface Props {
  asset: MediaAsset;
  onClick?: () => void;
  selected?: boolean;
}

// Grid card. Shows the 480 px variant for raster (or the original for
// svg/gif), plus filename, dimensions, size, kind and state chips.
export default function MediaCard({ asset, onClick, selected = false }: Props) {
  const preview = previewUrlFor(asset);
  const stateChip = stateChipFor(asset);
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? "primary.main" : undefined,
        borderWidth: selected ? 2 : 1,
        height: "100%",
      }}
      data-testid={`media-card-${asset.id}`}
    >
      <CardActionArea
        onClick={onClick}
        disabled={!onClick}
        sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        <Box
          sx={{
            aspectRatio: "1 / 1",
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {preview ? (
            <CardMedia
              component="img"
              image={preview}
              alt={asset.alt ?? ""}
              sx={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
            />
          ) : (
            <ImageIcon fontSize="large" color="action" />
          )}
        </Box>
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography
            variant="subtitle2"
            noWrap
            title={asset.filename ?? asset.id ?? ""}
          >
            {asset.filename ?? "unnamed"}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {dimensionsLabel(asset)} · {sizeLabel(asset.sizeBytes)}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
            <Chip
              size="small"
              label={asset.kind ?? "media"}
              data-testid={`media-kind-${asset.id}`}
            />
            {stateChip}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function previewUrlFor(asset: MediaAsset): string | null {
  if (asset.kind === "raster") {
    const v480 = asset.variants?.["480"];
    if (typeof v480 === "string" && v480.length > 0) return v480;
  }
  return typeof asset.url === "string" && asset.url.length > 0 ? asset.url : null;
}

function stateChipFor(asset: MediaAsset) {
  const state = asset.state ?? "";
  if (state === "orphaned") {
    return (
      <Chip
        size="small"
        color="warning"
        label={expiryLabel(asset)}
        data-testid={`media-state-${asset.id}`}
      />
    );
  }
  if (state === "pending") {
    return (
      <Chip
        size="small"
        color="default"
        label="Pending"
        data-testid={`media-state-${asset.id}`}
      />
    );
  }
  return null;
}

function expiryLabel(asset: MediaAsset): string {
  const iso = asset.orphanedAt;
  if (typeof iso !== "string") return "Orphaned";
  const now = Date.now();
  const orphanedAtMs = Date.parse(iso);
  if (Number.isNaN(orphanedAtMs)) return "Orphaned";
  const dayMs = 24 * 60 * 60 * 1000;
  const expiresAt = orphanedAtMs + 30 * dayMs;
  const days = Math.max(0, Math.ceil((expiresAt - now) / dayMs));
  return `Expires in ${days} d`;
}

function dimensionsLabel(asset: MediaAsset): string {
  const w = toNumber(asset.width);
  const h = toNumber(asset.height);
  if (w !== null && h !== null) return `${w} × ${h}`;
  return "no dimensions";
}

function sizeLabel(v: unknown): string {
  const n = toNumber(v);
  if (n === null) return "unknown size";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
