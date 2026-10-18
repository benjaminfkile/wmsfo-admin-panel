import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import { useQuery } from "@tanstack/react-query";
import { routes as routesApi } from "../../../api/resources/routes";
import ErrorAlert from "../../ErrorAlert";
import { keys } from "../../../queries/keys";
import { toRouteMapData } from "../../../routeMap/poster";
import { routeMapConfigSummary, toRouteMapConfig } from "../../../routeMap/eventRouteMap";
import RouteMapConfigDialog from "../../../pages/siteSettings/RouteMapConfigDialog";
import { toSiteRoute, withMapConfig, withRouteId } from "../siteRoute";
import RouteShapePreview from "./RouteShapePreview";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// The draft's `places`, handed in through `ui:options.places` so the
// route map dialog labels the places the draft sets.
function uiPlaces(node: unknown): unknown {
  if (node === null || typeof node !== "object") return undefined;
  const options = (node as Record<string, unknown>)["ui:options"];
  if (options === null || typeof options !== "object") return undefined;
  return (options as Record<string, unknown>).places;
}

// Site settings `route`, the Route card: the Recording select lists every
// flight recording by name plus None and writes `routeId` (null for
// None); "Route map settings" opens RouteMapConfigDialog over the chosen
// recording and writes `mapConfig` (disabled while None is chosen); the
// settings that differ from their defaults show as chips; and a small
// preview draws the chosen recording's path (GET
// /admin/routes/{id}/route-map). The line under the select names the
// published route (GET /admin/route), which the site keeps until the
// next publish. The title and help come from the uiSchema (the labels
// table).
export default function RouteField(props: FieldProps) {
  const ui = props.uiSchema;
  const help = uiString(ui, "ui:description");
  const disabled = props.disabled || props.readonly;
  const value = toSiteRoute(props.formData);
  const routeId = value.routeId;
  const [dialogOpen, setDialogOpen] = useState(false);
  const write = (next: unknown) => props.onChange(next, props.fieldPathId.path);

  const routesQ = useQuery({ queryKey: keys.routes, queryFn: () => routesApi.list() });
  const siteQ = useQuery({ queryKey: keys.siteRoute, queryFn: () => routesApi.site() });
  const routeMapQ = useQuery({
    queryKey: keys.routeMap(routeId ?? 0),
    queryFn: async () => toRouteMapData((await routesApi.routeMap(routeId ?? 0)).routeMap),
    enabled: routeId !== null,
  });

  const recordings = routesQ.data?.items ?? [];
  const unknown =
    routeId !== null && routesQ.isSuccess && !recordings.some((r) => Number(r.id) === routeId);
  const published = siteQ.data?.published ?? null;
  const publishedLine = !siteQ.isSuccess
    ? null
    : published === null
      ? "The site shows no route."
      : `The site shows ${published.name ?? `recording #${published.routeId}`}.`;
  const summary = routeMapConfigSummary(toRouteMapConfig(value.mapConfig));
  const path = routeMapQ.data?.path ?? [];

  return (
    <Box sx={{ my: 1, minWidth: 0 }} data-testid="route-field">
      <Typography variant="subtitle1">{uiString(ui, "ui:title") ?? "Route"}</Typography>
      {help ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
          {help}
        </Typography>
      ) : null}
      {routesQ.error ? <ErrorAlert error={routesQ.error} /> : null}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <TextField
            select
            label="Recording"
            size="small"
            value={routeId === null ? "" : String(routeId)}
            disabled={disabled}
            onChange={(e) =>
              write(withRouteId(props.formData, e.target.value === "" ? null : Number(e.target.value)))
            }
            slotProps={{
              select: { displayEmpty: true },
              inputLabel: { shrink: true },
              htmlInput: { "data-testid": "site-route-select" },
            }}
            sx={{ maxWidth: 360 }}
          >
            <MenuItem value="">None</MenuItem>
            {unknown ? <MenuItem value={String(routeId)}>{`#${routeId}`}</MenuItem> : null}
            {recordings.map((r) => (
              <MenuItem key={String(r.id)} value={String(r.id)}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>
          {publishedLine ? (
            <Typography variant="caption" color="text.secondary" data-testid="site-route-published">
              {publishedLine}
            </Typography>
          ) : null}
          <Box>
            <Button
              variant="outlined"
              size="small"
              disabled={disabled || routeId === null}
              onClick={() => setDialogOpen(true)}
              data-testid="site-route-map-settings"
            >
              Route map settings
            </Button>
          </Box>
          {summary.changed.length === 0 ? (
            <Typography variant="body2" data-testid="site-route-map-changed">
              Every route map setting is at its default.
            </Typography>
          ) : (
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              data-testid="site-route-map-changed"
            >
              {summary.changed.map((c) => (
                <Chip key={c.label} size="small" label={`${c.label}: ${c.value}`} />
              ))}
            </Stack>
          )}
        </Stack>
        {routeId !== null ? (
          routeMapQ.error ? (
            <Typography variant="caption" color="text.secondary" data-testid="site-route-preview-error">
              The preview could not load.
            </Typography>
          ) : routeMapQ.isSuccess && path.length === 0 ? (
            <Typography variant="caption" color="text.secondary" data-testid="site-route-preview-empty">
              This recording has no path to draw.
            </Typography>
          ) : path.length > 0 ? (
            <RouteShapePreview path={path} />
          ) : null
        ) : null}
      </Stack>
      {dialogOpen && routeId !== null ? (
        <RouteMapConfigDialog
          routeId={routeId}
          mapConfig={value.mapConfig}
          places={uiPlaces(ui)}
          onSave={(mapConfig) => write(withMapConfig(props.formData, mapConfig))}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </Box>
  );
}
