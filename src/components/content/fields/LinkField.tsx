import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { FieldProps } from "@rjsf/utils";
import type { Icon, IconInfo, MediaAsset } from "../../../api/types";
import IconPicker from "../pickers/IconPicker";
import IconPreview from "../IconPreview";
import InlineText from "../InlineText";
import { icons as iconsApi } from "../../../api/resources/icons";
import { media as mediaApi } from "../../../api/resources/media";
import { keys } from "../../../queries/keys";

type LinkValue = {
  label: string;
  href: string;
  icon: Icon | null;
  newTab: boolean;
};

const EMPTY: LinkValue = { label: "", href: "", icon: null, newTab: false };

// The `Link` primitive. Label (Inline through `InlineText`), href, icon,
// and newTab. The icon line uses IconPreview and MUI Buttons for Choose
// and Clear.
export default function LinkField(props: FieldProps) {
  const value = (props.formData as Partial<LinkValue> | undefined) ?? EMPTY;
  const [iconOpen, setIconOpen] = useState(false);

  const uiTitle = (props.uiSchema as { "ui:title"?: unknown } | undefined)?.[
    "ui:title"
  ];
  const label =
    typeof uiTitle === "string" && uiTitle.length > 0
      ? uiTitle
      : typeof props.schema.title === "string"
        ? props.schema.title
        : props.name;

  // Each part's label comes from the uiSchema entry for that part
  // (`ui:title`), or the default below.
  const partTitle = (key: string, fallback: string): string => {
    const part = (props.uiSchema as Record<string, unknown> | undefined)?.[key];
    const title =
      part !== null && typeof part === "object"
        ? (part as { "ui:title"?: unknown })["ui:title"]
        : undefined;
    return typeof title === "string" && title.length > 0 ? title : fallback;
  };

  const patch = (partial: Partial<LinkValue>) => {
    props.onChange(
      {
        label: value.label ?? "",
        href: value.href ?? "",
        icon: value.icon ?? null,
        newTab: value.newTab ?? false,
        ...partial,
      } as unknown,
      props.fieldPathId.path
    );
  };

  const icon = value.icon ?? null;
  const isLibrary = icon?.source === "library";
  const isMedia = icon?.source === "media";

  const iconsQ = useQuery({
    queryKey: keys.icons,
    queryFn: () => iconsApi.list(),
    enabled: isLibrary,
    staleTime: Infinity,
  });

  const mediaQ = useQuery({
    queryKey: keys.mediaAsset(String(icon?.id ?? "")),
    queryFn: () => mediaApi.get(String(icon?.id ?? "")),
    enabled: isMedia && typeof icon?.id === "string" && icon.id.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  const iconName = icon
    ? isLibrary
      ? ((iconsQ.data?.items ?? []).find(
          (i: IconInfo) => i.id === icon.id
        )?.name ?? String(icon.id))
      : ((mediaQ.data as MediaAsset | undefined)?.filename ?? String(icon.id))
    : null;

  return (
    <Box sx={{ my: 1 }} data-testid="link-field">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack spacing={1}>
        <InlineText
          value={value.label ?? ""}
          onChange={(next) => patch({ label: next })}
          label={partTitle("label", "Label")}
          maxLength={5000}
        />
        <TextField
          size="small"
          label={partTitle("href", "Href")}
          value={value.href ?? ""}
          onChange={(e) => patch({ href: e.target.value })}
          onBlur={() => props.onBlur(props.fieldPathId.$id, value)}
          fullWidth
        />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">{partTitle("icon", "Icon")}:</Typography>
          {icon ? (
            <>
              <IconPreview icon={icon} />
              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                {iconName}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              none
            </Typography>
          )}
          <Button size="small" onClick={() => setIconOpen(true)}>
            Choose icon
          </Button>
          {icon ? (
            <Button
              size="small"
              color="error"
              onClick={() => patch({ icon: null })}
            >
              Clear
            </Button>
          ) : null}
        </Stack>
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(value.newTab)}
              onChange={(e) => patch({ newTab: e.target.checked })}
            />
          }
          label={partTitle("newTab", "Open in new tab")}
        />
      </Stack>
      <IconPicker
        open={iconOpen}
        onCancel={() => setIconOpen(false)}
        onPick={(picked) => {
          setIconOpen(false);
          patch({ icon: picked });
        }}
      />
    </Box>
  );
}
