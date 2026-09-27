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
import type { Icon, IconInfo, MediaAsset } from "../../../api/types";
import IconPicker from "../pickers/IconPicker";
import IconPreview from "../IconPreview";
import DisplayControls from "../DisplayControls";
import { withDisplay } from "../display";
import InlineText from "../InlineText";
import { icons as iconsApi } from "../../../api/resources/icons";
import { media as mediaApi } from "../../../api/resources/media";
import { keys } from "../../../queries/keys";

export type LinkValue = {
  label: string;
  href: string;
  icon: Icon | null;
  newTab: boolean;
};

interface Props {
  label: string;
  value: LinkValue;
  onChange: (next: LinkValue) => void;
  testId?: string;
  // Labels for the parts of the link; each defaults to the name below.
  partLabels?: LinkPartLabels;
}

export type LinkPartLabels = Partial<
  Record<"label" | "href" | "icon" | "newTab", string>
>;

// The Link control used by block editors. Label (Inline), Href, an icon
// line (preview, Choose, Clear, and with an icon set the collapsed
// Advanced section for its `display`) and an "Open in new tab" checkbox.
export default function LinkControl({
  label,
  value,
  onChange,
  testId,
  partLabels,
}: Props) {
  const [iconOpen, setIconOpen] = useState(false);

  const patch = (partial: Partial<LinkValue>) => {
    onChange({ ...value, ...partial });
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
    <Box data-testid={testId ?? "link-control"}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack spacing={1}>
        <InlineText
          value={value.label}
          onChange={(next) => patch({ label: next })}
          label={partLabels?.label ?? "Label"}
          maxLength={5000}
        />
        <TextField
          size="small"
          label={partLabels?.href ?? "Href"}
          value={value.href}
          onChange={(e) => patch({ href: e.target.value })}
          fullWidth
        />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">
            {partLabels?.icon ?? "Icon"}:
          </Typography>
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
        {icon ? (
          <DisplayControls
            value={icon.display}
            onChange={(d) => patch({ icon: withDisplay(icon, d) })}
          />
        ) : null}
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(value.newTab)}
              onChange={(e) => patch({ newTab: e.target.checked })}
            />
          }
          label={partLabels?.newTab ?? "Open in new tab"}
        />
      </Stack>
      <IconPicker
        open={iconOpen}
        onCancel={() => setIconOpen(false)}
        onPick={(picked) => {
          setIconOpen(false);
          patch({
            icon: icon?.display ? { ...picked, display: icon.display } : picked,
          });
        }}
      />
    </Box>
  );
}
