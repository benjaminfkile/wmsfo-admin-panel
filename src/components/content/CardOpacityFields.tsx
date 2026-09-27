import { useState } from "react";
import { Box, Stack, TextField, Typography } from "@mui/material";
import { CARD_OPACITY_LABELS } from "./labels";
import {
  CARD_OPACITY_KEYS,
  CARD_OPACITY_MAX as MAX,
  CARD_OPACITY_MIN as MIN,
  type CardOpacityKey,
  type CardOpacityValue,
  clampOpacity,
} from "./cardOpacity";

// The "Card opacity" row: Light and Dark integer fields from 0 to 100
// side by side (stacked on compact). Each writes the clamped value
// while typing and shows it on blur; an empty entry writes undefined.
// `help` is the line under the row.
export default function CardOpacityFields({
  value,
  onChange,
  help,
  disabled,
  testId,
}: {
  value: CardOpacityValue;
  onChange: (key: CardOpacityKey, next: number | undefined) => void;
  help: string;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <Box data-testid={testId}>
      <Typography variant="caption" color="text.secondary" component="div">
        {CARD_OPACITY_LABELS.cardOpacity?.label}
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
        {CARD_OPACITY_KEYS.map((key) => (
          <OpacityInput
            key={key}
            label={CARD_OPACITY_LABELS[key]?.label ?? key}
            value={value[key]}
            onChange={(next) => onChange(key, next)}
            disabled={disabled}
            testId={`${testId}-${key === "cardOpacityLight" ? "light" : "dark"}`}
          />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" component="div">
        {help}
      </Typography>
    </Box>
  );
}

function OpacityInput({
  label,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  disabled?: boolean;
  testId: string;
}) {
  // The text being typed while the field has focus; null shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? "" : String(value));

  // Only an in-range integer is ever written, so a save while typing
  // never sends a value outside 0 to 100.
  const commit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === "") {
      onChange(undefined);
      return;
    }
    const n = Math.round(Number(trimmed));
    if (!Number.isFinite(n)) return;
    onChange(clampOpacity(n));
  };

  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={shown}
      onChange={(e) => {
        setDraft(e.target.value);
        commit(e.target.value);
      }}
      onBlur={() => {
        commit(shown);
        setDraft(null);
      }}
      disabled={disabled}
      slotProps={{ htmlInput: { min: MIN, max: MAX, step: 1, "data-testid": testId } }}
      fullWidth
    />
  );
}
