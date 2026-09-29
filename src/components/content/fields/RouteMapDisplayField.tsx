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
import type { FieldProps } from "@rjsf/utils";
import { useQuery } from "@tanstack/react-query";
import { siteSettings as siteSettingsApi } from "../../../api/resources/siteSettings";
import { keys } from "../../../queries/keys";
import { ROUTE_MAP_DISPLAY_LABELS } from "../labels";
import {
  ROUTE_MAP_CHOICES,
  ROUTE_MAP_DISPLAY_KEYS,
  readDisplayKey,
  resolveDisplayKey,
  withDisplayKey,
  type RouteMapDisplayKey,
  type RouteMapDisplayValue,
} from "../routeMapDisplay";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// The display text of a stored value, from the labels entry's options.
function displayText(key: RouteMapDisplayKey, value: RouteMapDisplayValue): string {
  return ROUTE_MAP_DISPLAY_LABELS[key]?.options?.[String(value)] ?? String(value);
}

// The stored value a select's text value stands for.
function fromText(key: RouteMapDisplayKey, text: string): RouteMapDisplayValue | undefined {
  return ROUTE_MAP_CHOICES[key].find((v) => String(v) === text);
}

type GroupProps = FieldProps & {
  // Sitewide: each control shows the built-in default while unset.
  // Override: each control shows "Site default (<value>)" while unset,
  // with the value resolved from `inherited`, and a Clear once set.
  mode: "sitewide" | "override";
  inherited: unknown;
  testId: string;
};

function RouteMapGroup(props: GroupProps) {
  const { mode, inherited, testId } = props;
  const title = uiString(props.uiSchema, "ui:title") ?? "Route map";
  const help = uiString(props.uiSchema, "ui:description");
  const disabled = Boolean(props.disabled || props.readonly);

  const write = (key: RouteMapDisplayKey, next: RouteMapDisplayValue | undefined) => {
    props.onChange(
      withDisplayKey(props.formData, key, next) as unknown,
      props.fieldPathId.path
    );
  };

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
          const value = readDisplayKey(props.formData, key);
          const effective = resolveDisplayKey([inherited], key);
          const entry = ROUTE_MAP_DISPLAY_LABELS[key];
          const label = entry?.label ?? key;
          const keyTestId = `${testId}-${key}`;
          if (mode === "sitewide" && key === "arrows") {
            return (
              <Box key={key}>
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

// The site settings `routeMap` block: Time labels, Arrow size, and
// Route line selects and an Arrows switch, each showing the built-in
// default while unset and writing only a picked value.
export default function RouteMapDisplayField(props: FieldProps) {
  return (
    <RouteMapGroup
      {...props}
      mode="sitewide"
      inherited={undefined}
      testId="route-map-sitewide"
    />
  );
}

// The route_preview `display` object: the same four knobs as selects
// that show "Site default (<value>)" while unset, the value read from
// the site settings draft's `routeMap` (else the built-in default). A
// pick writes the override; Clear removes the key so it inherits again,
// and removing the last key removes `display`.
export function RouteMapOverrideField(props: FieldProps) {
  const settingsQ = useQuery({
    queryKey: keys.siteSettings,
    queryFn: () => siteSettingsApi.get(),
  });
  const sitewide = (settingsQ.data?.data as Record<string, unknown> | undefined)?.routeMap;
  return (
    <RouteMapGroup
      {...props}
      mode="override"
      inherited={sitewide}
      testId="route-map-override"
    />
  );
}
