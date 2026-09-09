import {
  Box,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { FieldProps } from "@rjsf/utils";

// Theme editor for the site-settings `theme` object (admin.md 6.16).
// Renders accent swatches, surface swatches, font-pairing samples, and
// the "snow by default" switch. The wire shape mirrors the site
// settings schema: { accent, surface, fontPairing, snowDefault }.
export type ThemeValue = {
  accent: "red" | "green" | "gold" | "blue";
  surface: "night" | "snow" | "forest";
  fontPairing: "classic" | "festive" | "modern";
  snowDefault: boolean;
};

const ACCENTS: Array<{ id: ThemeValue["accent"]; color: string }> = [
  { id: "red", color: "#d84343" },
  { id: "green", color: "#2f8a4d" },
  { id: "gold", color: "#c48f2b" },
  { id: "blue", color: "#3462c4" },
];

const SURFACES: Array<{ id: ThemeValue["surface"]; color: string }> = [
  { id: "night", color: "#1c2333" },
  { id: "snow", color: "#f5f7fb" },
  { id: "forest", color: "#173a2b" },
];

const PAIRINGS: Array<{ id: ThemeValue["fontPairing"]; sample: string }> = [
  { id: "classic", sample: "Serif headline · sans body" },
  { id: "festive", sample: "Display headline · slab body" },
  { id: "modern", sample: "Grotesk headline · sans body" },
];

const DEFAULT: ThemeValue = {
  accent: "red",
  surface: "night",
  fontPairing: "classic",
  snowDefault: false,
};

function mergeTheme(v: unknown): ThemeValue {
  if (v === null || typeof v !== "object") return DEFAULT;
  const obj = v as Partial<ThemeValue>;
  return {
    accent: obj.accent ?? DEFAULT.accent,
    surface: obj.surface ?? DEFAULT.surface,
    fontPairing: obj.fontPairing ?? DEFAULT.fontPairing,
    snowDefault: Boolean(obj.snowDefault),
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
      <Stack spacing={2}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Accent
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            {ACCENTS.map((a) => (
              <Box
                key={a.id}
                onClick={() => patch({ accent: a.id })}
                role="button"
                aria-pressed={value.accent === a.id}
                aria-label={`Accent ${a.id}`}
                data-testid={`theme-accent-${a.id}`}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  cursor: "pointer",
                  backgroundColor: a.color,
                  outline:
                    value.accent === a.id ? "3px solid" : "1px solid",
                  outlineColor:
                    value.accent === a.id ? "primary.main" : "divider",
                }}
              />
            ))}
          </Stack>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Surface
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            {SURFACES.map((s) => (
              <Box
                key={s.id}
                onClick={() => patch({ surface: s.id })}
                role="button"
                aria-pressed={value.surface === s.id}
                aria-label={`Surface ${s.id}`}
                data-testid={`theme-surface-${s.id}`}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  cursor: "pointer",
                  color: s.id === "snow" ? "#111" : "#fff",
                  backgroundColor: s.color,
                  outline:
                    value.surface === s.id ? "3px solid" : "1px solid",
                  outlineColor:
                    value.surface === s.id ? "primary.main" : "divider",
                }}
              >
                {s.id}
              </Box>
            ))}
          </Stack>
        </Box>
        <TextField
          select
          size="small"
          label="Font pairing"
          value={value.fontPairing}
          onChange={(e) =>
            patch({ fontPairing: e.target.value as ThemeValue["fontPairing"] })
          }
          data-testid="theme-font-pairing"
        >
          {PAIRINGS.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.id}: {p.sample}
            </MenuItem>
          ))}
        </TextField>
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
      </Stack>
    </Box>
  );
}
