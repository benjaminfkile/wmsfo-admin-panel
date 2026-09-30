import {
  Box,
  Button,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { ROUTE_MAP_DISPLAY_LABELS } from "../labels";
import {
  ROUTE_MAP_CHOICES,
  ROUTE_MAP_DISPLAY_KEYS,
  ROUTE_MAP_DEFAULTS,
  readDisplayKey,
  withDisplayKey,
  type RouteMapDisplay,
  type RouteMapDisplayKey,
  type RouteMapDisplayValue,
} from "../routeMapDisplay";

// The display text of a stored value, from the labels entry's options.
function displayText(key: RouteMapDisplayKey, value: RouteMapDisplayValue): string {
  return ROUTE_MAP_DISPLAY_LABELS[key]?.options?.[String(value)] ?? String(value);
}

// The stored value a select's text value stands for.
function fromText(key: RouteMapDisplayKey, text: string): RouteMapDisplayValue | undefined {
  return ROUTE_MAP_CHOICES[key].find((v) => String(v) === text);
}

interface Props {
  // The stored display object, or undefined while nothing is set.
  value: unknown;
  // Reports the object with the key written, or undefined once empty.
  onChange: (next: RouteMapDisplay | undefined) => void;
  testId: string;
  title?: string;
  help?: string;
  disabled?: boolean;
  // A set key shows a "Default" button that removes it, so the control
  // shows the built-in default again.
  resettable?: boolean;
}

// The five route map display knobs: Time labels, Arrow size, Route line,
// and Label size selects and an Arrows switch, each showing the built-in default
// while unset and written only once picked.
export default function RouteMapDisplayControls({
  value: formData,
  onChange,
  testId,
  title = "Route map",
  help,
  disabled = false,
  resettable = false,
}: Props) {
  const write = (key: RouteMapDisplayKey, next: RouteMapDisplayValue | undefined) => {
    onChange(withDisplayKey(formData, key, next));
  };
  const resetButton = (key: RouteMapDisplayKey, label: string, set: boolean) =>
    resettable && set ? (
      <Button
        size="small"
        onClick={() => write(key, undefined)}
        disabled={disabled}
        aria-label={`Default ${label}`}
        data-testid={`${testId}-${key}-reset`}
        sx={{ mt: 1, flexShrink: 0 }}
      >
        Default
      </Button>
    ) : null;

  return (
    <Box sx={{ my: 1, minWidth: 0 }} data-testid={testId}>
      <Typography variant="subtitle2">{title}</Typography>
      {help ? (
        <Typography variant="caption" color="text.secondary" component="p">
          {help}
        </Typography>
      ) : null}
      <Stack spacing={2} sx={{ mt: 1 }}>
        {ROUTE_MAP_DISPLAY_KEYS.map((key) => {
          const value = readDisplayKey(formData, key);
          const effective = ROUTE_MAP_DEFAULTS[key];
          const entry = ROUTE_MAP_DISPLAY_LABELS[key];
          const label = entry?.label ?? key;
          const keyTestId = `${testId}-${key}`;
          if (key === "arrows") {
            return (
              <Stack key={key} direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={value === undefined ? Boolean(effective) : Boolean(value)}
                        disabled={disabled}
                        onChange={(e) => write(key, e.target.checked)}
                        slotProps={{ input: { "aria-label": label } }}
                        data-testid={keyTestId}
                      />
                    }
                    label={<Typography variant="body2">{label}</Typography>}
                  />
                  {entry?.help ? (
                    <FormHelperText sx={{ mt: 0 }}>{entry.help}</FormHelperText>
                  ) : null}
                </Box>
                {resetButton(key, label, value !== undefined)}
              </Stack>
            );
          }
          const unsetText = displayText(key, effective);
          return (
            <Stack
              key={key}
              direction="row"
              spacing={1}
              alignItems="flex-start"
              data-testid={keyTestId}
            >
              <TextField
                select
                fullWidth
                label={label}
                value={value === undefined ? "" : String(value)}
                disabled={disabled}
                helperText={entry?.help}
                onChange={(e) => write(key, fromText(key, e.target.value))}
                slotProps={{
                  inputLabel: { shrink: true },
                  select: {
                    displayEmpty: true,
                    renderValue: (v) =>
                      v === "" ? unsetText : displayText(key, String(v)),
                  },
                }}
              >
                {ROUTE_MAP_CHOICES[key].map((choice) => (
                  <MenuItem key={String(choice)} value={String(choice)}>
                    {displayText(key, choice)}
                  </MenuItem>
                ))}
              </TextField>
              {resetButton(key, label, value !== undefined)}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

