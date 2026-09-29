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
  readDisplayKey,
  resolveDisplayKey,
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
  // Sitewide: each control shows the built-in default while unset.
  // Override: each control shows "Site default (<value>)" while unset,
  // with the value resolved from `inherited`, and a Clear once set.
  mode: "sitewide" | "override";
  inherited?: unknown;
  testId: string;
  title?: string;
  help?: string;
  disabled?: boolean;
  // Sitewide only: a set key shows a "Default" button that removes it,
  // so the control shows the built-in default again.
  resettable?: boolean;
}

// The four route map display knobs: Time labels, Arrow size, and Route
// line selects and Arrows (a switch in sitewide mode, a select in
// override mode), each written only once picked.
export default function RouteMapDisplayControls({
  value: formData,
  onChange,
  mode,
  inherited,
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
    resettable && mode === "sitewide" && set ? (
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
          const effective = resolveDisplayKey([inherited], key);
          const entry = ROUTE_MAP_DISPLAY_LABELS[key];
          const label = entry?.label ?? key;
          const keyTestId = `${testId}-${key}`;
          if (mode === "sitewide" && key === "arrows") {
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
          const unsetText =
            mode === "override"
              ? `Site default (${displayText(key, effective)})`
              : displayText(key, effective);
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
              {mode === "override" && value !== undefined ? (
                <Button
                  size="small"
                  color="error"
                  onClick={() => write(key, undefined)}
                  disabled={disabled}
                  aria-label={`Clear ${label}`}
                  data-testid={`${keyTestId}-clear`}
                  sx={{ mt: 1 }}
                >
                  Clear
                </Button>
              ) : null}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

