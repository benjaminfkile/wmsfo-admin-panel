import { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DISPLAY_LABELS } from "./labels";
import { readDisplay, type Display, type DisplayKey } from "./display";

const SIZE_MIN = 12;
const SIZE_MAX = 600;
const PADDING_MIN = 0;
const PADDING_MAX = 48;

const SELECTS: Array<{
  key: "fit" | "shape" | "background" | "align";
  options: Array<[string, string]>;
}> = [
  {
    key: "fit",
    options: [
      ["contain", "Contain"],
      ["cover", "Cover"],
    ],
  },
  {
    key: "shape",
    options: [
      ["none", "None"],
      ["circle", "Circle"],
      ["rounded", "Rounded"],
      ["square", "Square"],
    ],
  },
  {
    key: "background",
    options: [
      ["none", "None"],
      ["surface", "Surface"],
      ["muted", "Muted"],
      ["accent", "Accent"],
      ["night", "Night"],
    ],
  },
  {
    key: "align",
    options: [
      ["start", "Start"],
      ["center", "Centre"],
      ["end", "End"],
    ],
  },
];

function labelOf(key: DisplayKey): string {
  return DISPLAY_LABELS[key]?.label ?? key;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

interface Props {
  // The owner's current `display` value (any shape; unknown keys and
  // non-objects are ignored).
  value: unknown;
  // Receives the next `display` holding only the set keys, or undefined
  // when none are set.
  onChange: (next: Display | undefined) => void;
  disabled?: boolean;
  testId?: string;
}

// A collapsed "Advanced" section under an icon or media picker with
// bounded controls for every `Display` key: Size (px) 12 to 600, Fit,
// Shape, Padding (px) 0 to 48, Background, Shadow, and Alignment, plus
// Reset, which removes `display`. Empty number fields and the "Default"
// select option remove their key; numbers out of range are clamped on
// blur. The toggle reads "Advanced (customised)" while any key is set.
export default function DisplayControls({
  value,
  onChange,
  disabled,
  testId,
}: Props) {
  const [open, setOpen] = useState(false);
  const current = readDisplay(value);
  const customised = Object.keys(current).length > 0;

  const write = (key: DisplayKey, next: unknown) => {
    const draft: Record<string, unknown> = { ...current };
    if (next === undefined) delete draft[key];
    else draft[key] = next;
    onChange(Object.keys(draft).length > 0 ? (draft as Display) : undefined);
  };

  return (
    <Box data-testid={testId ?? "display-controls"}>
      <Button
        size="small"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        endIcon={
          <ExpandMoreIcon
            sx={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 150ms",
            }}
          />
        }
        sx={{ px: 0, textTransform: "none" }}
      >
        {customised ? "Advanced (customised)" : "Advanced"}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <NumberControl
            label={labelOf("sizePx")}
            value={current.sizePx}
            min={SIZE_MIN}
            max={SIZE_MAX}
            hint="Empty uses the normal size"
            disabled={disabled}
            onChange={(n) => write("sizePx", n)}
          />
          {SELECTS.slice(0, 2).map((s) => (
            <SelectControl
              key={s.key}
              label={labelOf(s.key)}
              value={current[s.key]}
              options={s.options}
              disabled={disabled}
              onChange={(v) => write(s.key, v)}
            />
          ))}
          <NumberControl
            label={labelOf("paddingPx")}
            value={current.paddingPx}
            min={PADDING_MIN}
            max={PADDING_MAX}
            disabled={disabled}
            onChange={(n) => write("paddingPx", n)}
          />
          {SELECTS.slice(2, 3).map((s) => (
            <SelectControl
              key={s.key}
              label={labelOf(s.key)}
              value={current[s.key]}
              options={s.options}
              disabled={disabled}
              onChange={(v) => write(s.key, v)}
            />
          ))}
          <FormControlLabel
            control={
              <Switch
                checked={current.shadow === true}
                onChange={(e) =>
                  write("shadow", e.target.checked ? true : undefined)
                }
                disabled={disabled}
              />
            }
            label={labelOf("shadow")}
          />
          {SELECTS.slice(3).map((s) => (
            <SelectControl
              key={s.key}
              label={labelOf(s.key)}
              value={current[s.key]}
              options={s.options}
              disabled={disabled}
              onChange={(v) => write(s.key, v)}
            />
          ))}
          <Box>
            <Button
              size="small"
              color="error"
              onClick={() => onChange(undefined)}
              disabled={disabled || !customised}
            >
              Reset
            </Button>
          </Box>
        </Stack>
      </Collapse>
    </Box>
  );
}

// An integer field that writes while typing and clamps to its bounds on
// blur; an empty entry writes undefined.
function NumberControl({
  label,
  value,
  min,
  max,
  hint,
  disabled,
  onChange,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  hint?: string;
  disabled?: boolean;
  onChange: (next: number | undefined) => void;
}) {
  // The text being typed while the field has focus; null shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? "" : String(value));

  const commit = (text: string, clamped: boolean) => {
    const trimmed = text.trim();
    if (trimmed === "") {
      onChange(undefined);
      return;
    }
    const n = Math.round(Number(trimmed));
    if (!Number.isFinite(n)) return;
    onChange(clamped ? clamp(n, min, max) : n);
  };

  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={shown}
      onChange={(e) => {
        setDraft(e.target.value);
        commit(e.target.value, false);
      }}
      onBlur={() => {
        commit(shown, true);
        setDraft(null);
      }}
      helperText={hint}
      disabled={disabled}
      slotProps={{ htmlInput: { min, max, step: 1 } }}
      fullWidth
    />
  );
}

// A select with a "Default" option that writes undefined.
function SelectControl({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Array<[string, string]>;
  disabled?: boolean;
  onChange: (next: string | undefined) => void;
}) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : e.target.value)
      }
      disabled={disabled}
      fullWidth
      slotProps={{
        select: { displayEmpty: true },
        inputLabel: { shrink: true },
      }}
    >
      <MenuItem value="">Default</MenuItem>
      {options.map(([v, l]) => (
        <MenuItem key={v} value={v}>
          {l}
        </MenuItem>
      ))}
    </TextField>
  );
}
