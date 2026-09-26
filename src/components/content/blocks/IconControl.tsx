import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import IconPicker from "../pickers/IconPicker";
import IconPreview from "../IconPreview";
import { icons as iconsApi } from "../../../api/resources/icons";
import { media as mediaApi } from "../../../api/resources/media";
import { keys } from "../../../queries/keys";
import type { Icon, IconInfo, MediaAsset } from "../../../api/types";

interface Props {
  label: string;
  value: Icon | null;
  onChange: (next: Icon | null) => void;
  required?: boolean;
  testId?: string;
}

// The Icon control used by block editors. Preview, Choose (opens the
// shared icon picker), and Clear (hidden when the icon is required).
export default function IconControl({
  label,
  value,
  onChange,
  required,
  testId,
}: Props) {
  const [open, setOpen] = useState(false);
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
    <Box data-testid={testId ?? "block-icon-control"}>
      <Typography variant="caption" color="text.secondary">
        {label}
        {required ? " (required)" : ""}
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
        {value && !required ? (
          <Button size="small" color="error" onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : null}
      </Stack>
      <IconPicker
        open={open}
        onCancel={() => setOpen(false)}
        onPick={(next) => {
          setOpen(false);
          onChange(next);
        }}
      />
    </Box>
  );
}
