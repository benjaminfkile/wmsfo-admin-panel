import { Box, MenuItem, Select, Stack, Typography } from "@mui/material";
import IconControl from "./IconControl";
import type { Icon } from "../../../api/types";

type BlockLike = { kind: string; [k: string]: unknown };

interface Props {
  value: BlockLike;
  onChange: (next: BlockLike) => void;
}

const SIZES: { value: string; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra large" },
];

const ALIGNS: { value: string; label: string }[] = [
  { value: "start", label: "Start" },
  { value: "center", label: "Centre" },
];

// The icon block editor. Icon (preview, Choose; required), Size
// select, and Align select.
export default function IconBlockEditor({ value, onChange }: Props) {
  const icon =
    value.icon && typeof value.icon === "object"
      ? (value.icon as Icon)
      : null;
  const size =
    typeof value.size === "string" && SIZES.some((s) => s.value === value.size)
      ? (value.size as string)
      : "md";
  const align =
    typeof value.align === "string" &&
    ALIGNS.some((a) => a.value === value.align)
      ? (value.align as string)
      : "start";

  return (
    <Stack spacing={2} data-testid="block-icon">
      <IconControl
        label="Icon"
        value={icon}
        onChange={(next) => onChange({ ...value, icon: next })}
        required
        testId="block-icon-icon"
      />
      <Box>
        <Typography variant="caption" color="text.secondary">
          Size
        </Typography>
        <Select
          size="small"
          value={size}
          onChange={(e) => onChange({ ...value, size: e.target.value })}
          fullWidth
          data-testid="block-icon-size"
        >
          {SIZES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Align
        </Typography>
        <Select
          size="small"
          value={align}
          onChange={(e) => onChange({ ...value, align: e.target.value })}
          fullWidth
          data-testid="block-icon-align"
        >
          {ALIGNS.map((a) => (
            <MenuItem key={a.value} value={a.value}>
              {a.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Stack>
  );
}
