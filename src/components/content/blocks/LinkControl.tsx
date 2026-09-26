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
}

// The Link control used by block editors. Label, Href, an icon line
// (preview, Choose, Clear) and an "Open in new tab" checkbox.
export default function LinkControl({
  label,
  value,
  onChange,
  testId,
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
        <TextField
          size="small"
          label="Label"
          value={value.label}
          onChange={(e) => patch({ label: e.target.value })}
          fullWidth
          inputProps={{ maxLength: 5000 }}
        />
        <TextField
          size="small"
          label="Href"
          value={value.href}
          onChange={(e) => patch({ href: e.target.value })}
          fullWidth
        />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2">Icon:</Typography>
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
          label="Open in new tab"
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
