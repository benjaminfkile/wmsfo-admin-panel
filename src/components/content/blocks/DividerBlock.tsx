import { Box, MenuItem, Select, Stack, Typography } from "@mui/material";

type BlockLike = { kind: string; [k: string]: unknown };

interface Props {
  value: BlockLike;
  onChange: (next: BlockLike) => void;
}

const STYLES: { value: string; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "snowflakes", label: "Snowflakes" },
  { value: "lights", label: "Lights" },
];

// The divider block editor. Style (line, snowflakes, lights).
export default function DividerBlockEditor({ value, onChange }: Props) {
  const style =
    typeof value.style === "string" &&
    STYLES.some((s) => s.value === value.style)
      ? (value.style as string)
      : "line";
  return (
    <Stack spacing={2} data-testid="block-divider">
      <Box>
        <Typography variant="caption" color="text.secondary">
          Style
        </Typography>
        <Select
          size="small"
          value={style}
          onChange={(e) => onChange({ ...value, style: e.target.value })}
          fullWidth
          data-testid="block-divider-style"
        >
          {STYLES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Stack>
  );
}
