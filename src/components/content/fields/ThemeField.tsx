import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { FieldProps } from "@rjsf/utils";

// Theme editor for the site-settings `theme` object (admin.md 6.16).
// Colours and fonts are part of the site design; visitors pick light
// or dark themselves, so the panel only shows the three flags that
// admins can flip: whether snow, lights, and ornaments start on.
// The incoming value is spread through so any key this field does
// not know is kept.
export type ThemeValue = {
  snowDefault: boolean;
  lightsDefault: boolean;
  ornaments: boolean;
};

const DEFAULT: ThemeValue = {
  snowDefault: false,
  lightsDefault: true,
  ornaments: false,
};

type UnknownRecord = Record<string, unknown>;

function baseObject(v: unknown): UnknownRecord {
  if (v === null || typeof v !== "object") return {};
  return v as UnknownRecord;
}

function readFlag(obj: UnknownRecord, key: keyof ThemeValue): boolean {
  const raw = obj[key];
  return raw === undefined ? DEFAULT[key] : Boolean(raw);
}

export default function ThemeField(props: FieldProps) {
  const raw = baseObject(props.formData);
  const value: ThemeValue = {
    snowDefault: readFlag(raw, "snowDefault"),
    lightsDefault: readFlag(raw, "lightsDefault"),
    ornaments: readFlag(raw, "ornaments"),
  };

  const patch = (partial: Partial<ThemeValue>) => {
    props.onChange(
      { ...raw, ...value, ...partial } as unknown,
      props.fieldPathId.path
    );
  };

  return (
    <Box sx={{ my: 1 }} data-testid="theme-field">
      <Typography variant="subtitle2" gutterBottom>
        Theme
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Colours and fonts are part of the site design; visitors pick light
        or dark themselves.
      </Typography>
      <Stack spacing={1} sx={{ mt: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={value.snowDefault}
              onChange={(e) => patch({ snowDefault: e.target.checked })}
              data-testid="theme-snow-default"
            />
          }
          label="Snow on by default"
        />
        <FormControlLabel
          control={
            <Switch
              checked={value.lightsDefault}
              onChange={(e) => patch({ lightsDefault: e.target.checked })}
              data-testid="theme-lights-default"
            />
          }
          label="Lights on by default"
        />
        <FormControlLabel
          control={
            <Switch
              checked={value.ornaments}
              onChange={(e) => patch({ ornaments: e.target.checked })}
              data-testid="theme-ornaments"
            />
          }
          label="Ornaments in the background"
        />
      </Stack>
    </Box>
  );
}
