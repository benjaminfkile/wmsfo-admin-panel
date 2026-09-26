import { useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import MediaPicker from "../MediaPicker";
import MediaPreview from "../MediaPreview";
import type { MediaAsset, MediaRef } from "../../../api/types";

// The `MediaRef` primitive. MediaPreview stands in for the id; keep the
// Choose button and an alt override text field.
export default function MediaField(props: FieldProps) {
  const value = (props.formData as MediaRef | null | undefined) ?? {
    mediaId: "",
    alt: null,
  };
  const [open, setOpen] = useState(false);

  const label =
    typeof props.schema.title === "string" ? props.schema.title : props.name;

  const setAlt = (alt: string) => {
    props.onChange(
      { ...value, alt: alt === "" ? null : alt } as unknown,
      props.fieldPathId.path
    );
  };

  const pick = (asset: MediaAsset) => {
    setOpen(false);
    props.onChange(
      { mediaId: asset.id ?? "", alt: value.alt ?? null } as unknown,
      props.fieldPathId.path
    );
  };

  return (
    <Box sx={{ my: 1 }} data-testid="media-field">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap">
        {value.mediaId ? (
          <MediaPreview mediaId={value.mediaId} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No media
          </Typography>
        )}
        <Button size="small" onClick={() => setOpen(true)}>
          Choose
        </Button>
      </Stack>
      <TextField
        size="small"
        label="Alt text (leave empty to use the image's own)"
        value={value.alt ?? ""}
        onChange={(e) => setAlt(e.target.value)}
        onBlur={() => props.onBlur(props.fieldPathId.$id, value)}
        fullWidth
        sx={{ mt: 1 }}
      />
      <MediaPicker
        open={open}
        onCancel={() => setOpen(false)}
        onPick={pick}
      />
    </Box>
  );
}
