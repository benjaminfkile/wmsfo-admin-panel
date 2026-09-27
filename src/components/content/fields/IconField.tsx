import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { FieldProps } from "@rjsf/utils";
import IconPicker from "../pickers/IconPicker";
import IconPreview from "../IconPreview";
import { icons as iconsApi } from "../../../api/resources/icons";
import { media as mediaApi } from "../../../api/resources/media";
import { keys } from "../../../queries/keys";
import type { Icon, IconInfo, MediaAsset } from "../../../api/types";

// The `Icon` primitive. IconPreview shows the picked icon next to its
// name (library) or filename (media); Choose opens the shared icon
// picker; Clear removes the value on nullable schemas.
// `ui:options.hint` shows a short line under the field.
export default function IconField(props: FieldProps) {
  const value = (props.formData as Icon | null | undefined) ?? null;
  const oneOf = (props.schema as { oneOf?: unknown[] }).oneOf;
  const nullable = Array.isArray(oneOf);
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
  const uiOptions = (props.uiSchema as { "ui:options"?: { hint?: unknown } } | undefined)?.[
    "ui:options"
  ];
  const hint = typeof uiOptions?.hint === "string" ? uiOptions.hint : "";

  const isLibrary = value?.source === "library";
  const isMedia = value?.source === "media";

  const iconsQ = useQuery({
    queryKey: keys.icons,
    queryFn: () => iconsApi.list(),
    enabled: isLibrary,
    staleTime: Infinity,
  });

  const mediaQ = useQuery({
    queryKey: keys.mediaAsset(String(value?.id ?? "")),
    queryFn: () => mediaApi.get(String(value?.id ?? "")),
    enabled: isMedia && typeof value?.id === "string" && value.id.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const displayName = value
    ? isLibrary
      ? ((iconsQ.data?.items ?? []).find(
          (i: IconInfo) => i.id === value.id
        )?.name ?? String(value.id))
      : ((mediaQ.data as MediaAsset | undefined)?.filename ?? String(value.id))
    : null;

  return (
    <Box sx={{ my: 1 }} data-testid="icon-field">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {value ? (
          <>
            <IconPreview icon={value} />
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {displayName}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            None
          </Typography>
        )}
        <Button size="small" onClick={() => setOpen(true)}>
          Choose
        </Button>
        {value && nullable ? (
          <Button
            size="small"
            color="error"
            onClick={() => props.onChange(null, props.fieldPathId.path)}
          >
            Clear
          </Button>
        ) : null}
      </Stack>
      {hint ? (
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          data-testid="icon-field-hint"
        >
          {hint}
        </Typography>
      ) : null}
      <IconPicker
        open={open}
        onCancel={() => setOpen(false)}
        onPick={(next) => {
          setOpen(false);
          props.onChange(next as unknown, props.fieldPathId.path);
        }}
      />
    </Box>
  );
}
