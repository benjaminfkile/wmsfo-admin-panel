import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import IconControl from "./IconControl";
import type { Icon } from "../../../api/types";

type BlockLike = { kind: string; [k: string]: unknown };

interface Props {
  value: BlockLike;
  onChange: (next: BlockLike) => void;
}

const STYLES: { value: string; label: string }[] = [
  { value: "bullet", label: "Bullets" },
  { value: "number", label: "Numbers" },
  { value: "icon", label: "Icon" },
];

const MAX_LINES = 100;

function toItems(items: unknown): string[] {
  if (!Array.isArray(items)) return [""];
  const out = items.map((it) => (typeof it === "string" ? it : ""));
  return out.length === 0 ? [""] : out;
}

// The list block editor. Style select (bullets, numbers, icon), Icon
// (shown and required only when Style is Icon; switching away clears
// it), and the lines (at least one, at most 100) with per line remove,
// up and down arrows, and Add line.
export default function ListBlockEditor({ value, onChange }: Props) {
  const style =
    typeof value.style === "string" &&
    STYLES.some((s) => s.value === value.style)
      ? (value.style as string)
      : "bullet";
  const items = toItems(value.items);
  const icon =
    value.icon && typeof value.icon === "object"
      ? (value.icon as Icon)
      : null;

  const setStyle = (next: string) => {
    if (next === "icon") {
      onChange({ ...value, style: next });
    } else {
      onChange({ ...value, style: next, icon: null });
    }
  };

  const setItems = (next: string[]) => {
    onChange({ ...value, items: next });
  };

  const patchLine = (index: number, text: string) => {
    const next = items.slice();
    next[index] = text;
    setItems(next);
  };

  const addLine = () => {
    if (items.length >= MAX_LINES) return;
    setItems([...items, ""]);
  };

  const removeLine = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const moveLine = (from: number, to: number) => {
    if (from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    if (from === to) return;
    const next = items.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x as string);
    setItems(next);
  };

  return (
    <Stack spacing={2} data-testid="block-list">
      <Box>
        <Typography variant="caption" color="text.secondary">
          Style
        </Typography>
        <Select
          size="small"
          value={style}
          onChange={(e) => setStyle(String(e.target.value))}
          fullWidth
          data-testid="block-list-style"
        >
          {STYLES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
      {style === "icon" ? (
        <IconControl
          label="Icon"
          value={icon}
          onChange={(next) => onChange({ ...value, icon: next })}
          required
          testId="block-list-icon"
        />
      ) : null}
      <Box>
        <Typography variant="caption" color="text.secondary">
          Lines
        </Typography>
        <Stack spacing={1} data-testid="block-list-lines">
          {items.map((line, i) => (
            <Stack
              key={i}
              direction="row"
              spacing={0.5}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              data-testid={`block-list-line-${i}`}
            >
              <TextField
                size="small"
                value={line}
                onChange={(e) => patchLine(i, e.target.value)}
                sx={{ flexGrow: 1, minWidth: 120 }}
                inputProps={{
                  maxLength: 5000,
                  "aria-label": `Line ${i + 1}`,
                }}
              />
              <IconButton
                size="small"
                onClick={() => moveLine(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move line ${i + 1} up`}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => moveLine(i, i + 1)}
                disabled={i === items.length - 1}
                aria-label={`Move line ${i + 1} down`}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => removeLine(i)}
                disabled={items.length <= 1}
                aria-label={`Remove line ${i + 1}`}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            onClick={addLine}
            disabled={items.length >= MAX_LINES}
          >
            Add line
          </Button>
        </Box>
      </Box>
    </Stack>
  );
}
