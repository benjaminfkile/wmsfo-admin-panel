import {
  Box,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import IconControl from "./IconControl";
import InlineText from "../InlineText";
import type { Icon } from "../../../api/types";

type BlockLike = { kind: string; [k: string]: unknown };

interface Props {
  value: BlockLike;
  onChange: (next: BlockLike) => void;
}

// The heading block editor. Text (Inline), level (1, 2, 3), icon.
export default function HeadingBlockEditor({ value, onChange }: Props) {
  const text = typeof value.text === "string" ? value.text : "";
  const level = value.level === 1 || value.level === 2 || value.level === 3
    ? value.level
    : 2;
  const icon =
    value.icon && typeof value.icon === "object"
      ? (value.icon as Icon)
      : null;

  return (
    <Stack spacing={2} data-testid="block-heading">
      <InlineText
        value={text}
        onChange={(next) => onChange({ ...value, text: next })}
        label="Text"
        maxLength={5000}
        multiline
        minRows={1}
      />
      <Box>
        <Typography variant="caption" color="text.secondary">
          Heading level
        </Typography>
        <Select
          size="small"
          value={level}
          onChange={(e) =>
            onChange({ ...value, level: Number(e.target.value) })
          }
          fullWidth
          data-testid="block-heading-level"
        >
          <MenuItem value={1}>1</MenuItem>
          <MenuItem value={2}>2</MenuItem>
          <MenuItem value={3}>3</MenuItem>
        </Select>
      </Box>
      <IconControl
        label="Icon"
        value={icon}
        onChange={(next) => onChange({ ...value, icon: next })}
        testId="block-heading-icon"
      />
    </Stack>
  );
}
