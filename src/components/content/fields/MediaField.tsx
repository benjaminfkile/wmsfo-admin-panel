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
import DisplayControls from "../DisplayControls";
import { withDisplay } from "../display";
import type { MediaAsset, MediaRef } from "../../../api/types";

// The `MediaRef` primitive. MediaPreview stands in for the id; keep the
// Choose button, an alt override text field, and, with media picked, the
// collapsed Advanced section (DisplayControls) for its `display`.
type MediaRefWithDisplay = MediaRef & { display?: unknown };

export default function MediaField(props: FieldProps) {
  const value = (props.formData as MediaRefWithDisplay | null | undefined) ?? {
    mediaId: "",
    alt: null,
  };
  const [open, setOpen] = useState(false);

  const uiTitle = (props.uiSchema as { "ui:title"?: unknown } | undefined)?.[
    "ui:title"
  ];
  const label =
    typeof uiTitle === "string" && uiTitle.length > 0
      ? uiTitle
      : typeof props.schema.title === "string"
        ? props.schema.title
        : props.name;

  const setAlt = (alt: string) => {
    props.onChange(
      { ...value, alt: alt === "" ? null : alt } as unknown,
      props.fieldPathId.path
    );
  };

  const pick = (asset: MediaAsset) => {
    setOpen(false);
    props.onChange(
      { ...value, mediaId: asset.id ?? "", alt: value.alt ?? null } as unknown,
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
      {value.mediaId ? (
        <DisplayControls
          value={value.display}
          onChange={(d) =>
            props.onChange(withDisplay(value, d) as unknown, props.fieldPathId.path)
          }
        />
      ) : null}
      <MediaPicker
        open={open}
        onCancel={() => setOpen(false)}
        onPick={pick}
      />
    </Box>
  );
}
