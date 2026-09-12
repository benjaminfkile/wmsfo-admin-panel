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
// or dark themselves, so the panel only shows the two flags that
// admins can flip: whether snow and the lights start on.
export type ThemeValue = {
  snowDefault: boolean;
  lightsDefault: boolean;
};

const DEFAULT: ThemeValue = {
  snowDefault: false,
  lightsDefault: true,
};

function mergeTheme(v: unknown): ThemeValue {
  if (v === null || typeof v !== "object") return DEFAULT;
  const obj = v as Partial<ThemeValue>;
  return {
    snowDefault: Boolean(obj.snowDefault),
    lightsDefault:
      obj.lightsDefault === undefined
        ? DEFAULT.lightsDefault
        : Boolean(obj.lightsDefault),
  };
}

export default function ThemeField(props: FieldProps) {
  const value = mergeTheme(props.formData);

  const patch = (partial: Partial<ThemeValue>) => {
    props.onChange({ ...value, ...partial } as unknown, props.fieldPathId.path);
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
      </Stack>
    </Box>
  );
}
