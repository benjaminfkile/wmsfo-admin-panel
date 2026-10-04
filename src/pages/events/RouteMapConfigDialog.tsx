import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormHelperText,
  LinearProgress,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppDialog from "../../components/AppDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PoisEditor from "../../components/content/fields/PoisEditor";
import RouteMapDisplayControls from "../../components/content/fields/RouteMapDisplayControls";
import { useConfig } from "../../ConfigContext";
import { events as eventsApi } from "../../api/resources/events";
import type { Event } from "../../api/types";
import { useNotify } from "../../hooks/useNotify";
import { keys } from "../../queries/keys";
import { routeBasemapBase, type Appearance } from "../../routeMap";
import {
  ROUTE_MAP_CONTROL_KEYS,
  ROUTE_MAP_CONTROL_LABELS,
  eventRouteMapStyle,
  readControl,
  routeMapConfigBody,
  toRouteMapConfig,
  withControl,
  withGroup,
  type RouteMapConfigValue,
} from "../../routeMap/eventRouteMap";
import { probeTerrain, toRouteMapData } from "../../routeMap/poster";
import EventRouteMapPreview from "./EventRouteMapPreview";
import RouteMapCopyFrom from "./RouteMapCopyFrom";

interface Props {
  event: Event;
  onClose: () => void;
}

const NO_RECORDING_HINT =
  "Link a flight recording to this event under Flight history to preview its route map.";
const NO_PATH_HINT = "The linked flight recording has no path to draw.";
const NO_BASEMAP_HINT =
  "The route map preview needs VITE_ROUTE_BASEMAP_URL, which is not set.";

// Configures the event's route map: a live preview of this event's route
// beside "Copy from another event" and three groups of controls (Display,
// Controls, Points of interest). Full screen on phones and
// nearly the whole window on desktop. The dialog edits a draft of
// `routeMapConfig`; every change rebuilds the preview's style through
// `eventRouteMapStyle`. Copying replaces the whole draft with the picked
// event's config and writes nothing until Save. Save sends
// `PATCH { routeMapConfig }` (null when no group is set); Cancel drops the
// draft; Clear all, after a confirm, sends `routeMapConfig: null`. With no
// linked recording, no path, or no basemap URL the preview area holds only
// the hint.
export default function RouteMapConfigDialog({ event, onClose }: Props) {
  const config = useConfig();
  const qc = useQueryClient();
  const notify = useNotify();
  const id = Number(event.id);
  const routeId = event.routeId === null || event.routeId === undefined ? null : Number(event.routeId);
  const [draft, setDraft] = useState<RouteMapConfigValue>(() =>
    toRouteMapConfig(event.routeMapConfig)
  );
  const [appearance, setAppearance] = useState<Appearance>("light");
  const [terrainOn, setTerrainOn] = useState(false);
  const [terrainAvailable, setTerrainAvailable] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const base = routeBasemapBase(config);
  useEffect(() => {
    if (base === null) return;
    let active = true;
    void probeTerrain(base).then((found) => {
      if (active) setTerrainAvailable(found);
    });
    return () => {
      active = false;
    };
  }, [base]);

  const routeMapQ = useQuery({
    queryKey: keys.eventRouteMap(id, routeId),
    queryFn: async () => toRouteMapData((await eventsApi.routeMap(id)).routeMap),
    enabled: routeId !== null,
  });
  const routeMap = routeMapQ.data ?? null;
  const drawable = routeMap && routeMap.path.length > 0 ? routeMap : null;

  const terrainKept = readControl(draft.controls, "terrain");
  const previewStyle = useMemo(
    () =>
      drawable && base !== null
        ? eventRouteMapStyle(config, {
            appearance,
            routeMap: drawable,
            routeMapConfig: draft,
            terrain: terrainOn && terrainAvailable,
          })
        : null,
    [drawable, base, config, appearance, draft, terrainOn, terrainAvailable]
  );

  const saveMut = useMutation({
    mutationFn: (routeMapConfig: RouteMapConfigValue | null) =>
      eventsApi.patch(id, { routeMapConfig }),
    onSuccess: (_data, routeMapConfig) => {
      notify(routeMapConfig === null ? "Route map cleared" : "Route map saved");
      void qc.invalidateQueries({ queryKey: keys.event(id) });
      void qc.invalidateQueries({ queryKey: keys.events });
      onClose();
    },
  });

  const set = <K extends keyof RouteMapConfigValue>(
    key: K,
    value: RouteMapConfigValue[K] | undefined
  ) => setDraft((d) => withGroup(d, key, value));

  const busy = saveMut.isPending;

  const preview = (() => {
    if (routeId === null) return <Hint>{NO_RECORDING_HINT}</Hint>;
    if (base === null) return <Hint>{NO_BASEMAP_HINT}</Hint>;
    if (routeMapQ.isError) {
      return (
        <Alert severity="warning" data-testid="route-map-preview-hint">
          The preview could not load.{" "}
          {routeMapQ.error instanceof Error ? routeMapQ.error.message : ""}
        </Alert>
      );
    }
    if (routeMapQ.isPending) {
      return (
        <Box data-testid="route-map-preview-loading">
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Loading the preview
          </Typography>
          <LinearProgress />
        </Box>
      );
    }
    if (!drawable || !previewStyle) return <Hint>{NO_PATH_HINT}</Hint>;
    return (
      <EventRouteMapPreview
        style={previewStyle}
        path={drawable.path}
        fullscreenButton={readControl(draft.controls, "fullscreen")}
        terrainButton={terrainKept}
        terrainOn={terrainOn && terrainKept}
        onToggleTerrain={() => setTerrainOn((on) => !on)}
      />
    );
  })();

  return (
    <>
      <AppDialog
        open
        onClose={busy ? undefined : onClose}
        maxWidth={false}
        fullWidth
        aria-labelledby="route-map-config-title"
        slotProps={{
          paper: {
            sx: { height: { sm: "calc(100% - 64px)" }, maxHeight: { sm: "calc(100% - 64px)" } },
          },
        }}
        data-testid="route-map-config-dialog"
      >
        <DialogTitle id="route-map-config-title">Route map</DialogTitle>
        <DialogContent
          dividers
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            minHeight: 0,
          }}
        >
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0, minHeight: { xs: 360, md: 0 } }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={appearance}
              onChange={(_e, v: Appearance | null) => {
                if (v) setAppearance(v);
              }}
              aria-label="Preview appearance"
            >
              <ToggleButton value="light">Light</ToggleButton>
              <ToggleButton value="dark">Dark</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1, minHeight: 0 }} data-testid="route-map-preview-area">
              {preview}
            </Box>
          </Stack>
          <Box
            sx={{ width: { xs: "100%", md: 400 }, flexShrink: 0, overflowY: { md: "auto" }, pr: { md: 1 } }}
            data-testid="route-map-config-controls"
          >
            {saveMut.error ? <ErrorAlert error={saveMut.error} /> : null}
            <Group title="Copy from another event">
              <RouteMapCopyFrom eventId={id} disabled={busy} onPick={setDraft} />
            </Group>
            <Group title="Display">
              <RouteMapDisplayControls
                value={draft.display}
                onChange={(next) => set("display", next)}
                resettable
                testId="route-map-display"
                title="Route line and labels"
                help="Each setting shows the built-in default until you pick one."
                disabled={busy}
              />
            </Group>
            <Group title="Controls">
              <Stack spacing={1} data-testid="route-map-controls">
                {ROUTE_MAP_CONTROL_KEYS.map((key) => (
                  <Box key={key}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={readControl(draft.controls, key)}
                          disabled={busy}
                          onChange={(e) =>
                            set("controls", withControl(draft.controls, key, e.target.checked))
                          }
                          slotProps={{ input: { "aria-label": ROUTE_MAP_CONTROL_LABELS[key].label } }}
                        />
                      }
                      label={<Typography variant="body2">{ROUTE_MAP_CONTROL_LABELS[key].label}</Typography>}
                    />
                    <FormHelperText sx={{ mt: 0 }}>{ROUTE_MAP_CONTROL_LABELS[key].help}</FormHelperText>
                  </Box>
                ))}
              </Stack>
            </Group>
            <Group title="Points of interest" last>
              <PoisEditor
                value={draft.pois}
                onChange={(next) => set("pois", next)}
                title="Points of interest"
                help="Default keeps the map as it is; Custom labels only the kinds of places you check."
                disabled={busy}
              />
            </Group>
          </Box>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            color="error"
            onClick={() => setConfirmClear(true)}
            disabled={busy}
            sx={{ mr: "auto" }}
          >
            Clear all
          </Button>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => saveMut.mutate(routeMapConfigBody(draft))}
            disabled={busy}
          >
            Save
          </Button>
        </DialogActions>
      </AppDialog>
      <ConfirmDialog
        open={confirmClear}
        title="Clear the route map settings?"
        body={`Every route map setting of ${event.name ?? "this event"} returns to its default.`}
        confirmLabel="Clear all"
        danger
        disabled={busy}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          saveMut.mutate(null);
        }}
      />
    </>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <Alert severity="info" variant="outlined" data-testid="route-map-preview-hint">
      {children}
    </Alert>
  );
}

function Group({ title, children, last }: { title: string; children: ReactNode; last?: boolean }) {
  return (
    <Box component="section" aria-label={title} sx={{ mb: 2 }}>
      <Typography variant="h6" component="h3" sx={{ fontSize: "1rem", mb: 0.5 }}>
        {title}
      </Typography>
      {children}
      {last ? null : <Divider sx={{ mt: 2 }} />}
    </Box>
  );
}
