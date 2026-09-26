import { useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MediaPicker from "../MediaPicker";
import MediaPreview from "../MediaPreview";
import InlineText from "../InlineText";
import type { MediaAsset } from "../../../api/types";

type MediaRef = { mediaId: string; alt: string | null };
type BlockLike = { kind: string; [k: string]: unknown };

interface Props {
  value: BlockLike;
  onChange: (next: BlockLike) => void;
}

const SIZES: { value: string; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "full", label: "Full width" },
];

function toMediaRef(v: unknown): MediaRef {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return {
      mediaId: typeof o.mediaId === "string" ? o.mediaId : "",
      alt: typeof o.alt === "string" ? o.alt : null,
    };
  }
  return { mediaId: "", alt: null };
}

// The media block editor. Media (preview, Choose, alt override), an
// optional Caption (empty stores null), and a Size select.
export default function MediaBlockEditor({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const media = toMediaRef(value.media);
  const caption = typeof value.caption === "string" ? value.caption : "";
  const size =
    typeof value.size === "string" && SIZES.some((s) => s.value === value.size)
      ? (value.size as string)
      : "medium";

  const setMedia = (next: MediaRef) => onChange({ ...value, media: next });
  const setAlt = (alt: string) =>
    setMedia({ ...media, alt: alt === "" ? null : alt });
  const pick = (asset: MediaAsset) => {
    setOpen(false);
    setMedia({ mediaId: asset.id ?? "", alt: media.alt });
  };

  return (
    <Stack spacing={2} data-testid="block-media">
      <Box>
        <Typography variant="caption" color="text.secondary">
          Image
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          flexWrap="wrap"
        >
          {media.mediaId ? (
            <MediaPreview mediaId={media.mediaId} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No media
            </Typography>
          )}
          <Button size="small" onClick={() => setOpen(true)}>
            Choose
          </Button>
        </Stack>
      </Box>
      <TextField
        size="small"
        label="Alt text (leave empty to use the image's own)"
        value={media.alt ?? ""}
        onChange={(e) => setAlt(e.target.value)}
        fullWidth
        inputProps={{ maxLength: 5000 }}
      />
      <Box data-testid="block-media-caption">
        <InlineText
          value={caption}
          onChange={(next) =>
            onChange({ ...value, caption: next === "" ? null : next })
          }
          label="Caption (optional)"
          maxLength={5000}
          multiline
          minRows={1}
        />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Size
        </Typography>
        <Select
          size="small"
          value={size}
          onChange={(e) => onChange({ ...value, size: e.target.value })}
          fullWidth
          data-testid="block-media-size"
        >
          {SIZES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <MediaPicker
        open={open}
        onCancel={() => setOpen(false)}
        onPick={pick}
      />
    </Stack>
  );
}
