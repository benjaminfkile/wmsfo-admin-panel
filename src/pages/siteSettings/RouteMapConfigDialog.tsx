import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  Divider,
  FormControlLabel,
  FormHelperText,
  LinearProgress,
  Link,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import AppDialog from "../../components/AppDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import RouteMapDisplayControls from "../../components/content/fields/RouteMapDisplayControls";
import { events as eventsApi } from "../../api/resources/events";
import { routes as routesApi } from "../../api/resources/routes";
import { maps as mapsApi } from "../../api/resources/maps";
import { themes as themesApi } from "../../api/resources/themes";
import { placesPart } from "../../components/content/places";
import { keys } from "../../queries/keys";
import {
  ROUTE_MAP_CONTROL_KEYS,
  ROUTE_MAP_CONTROL_LABELS,
  eventRouteMapSource,
  eventRouteMapStyle,
  readControl,
  routeMapConfigBody,
  routeViewEvent,
  toRouteMapConfig,
  withControl,
  withGroup,
  type Appearance,
  type RouteMapConfigValue,
} from "../../routeMap/eventRouteMap";
import { toRouteMapData } from "../../routeMap/poster";
import { themeStyleQuery } from "../../routeMap/themeStyle";
import RouteMapPreview from "./RouteMapPreview";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";

interface Props {
  // The site route the preview draws (`settings.route.routeId`).
  routeId: number;
  // The draft's `settings.route.mapConfig`.
  mapConfig: unknown;
  // The draft's `places`, whose `routeMap.kinds` the preview labels.
  places: unknown;
  // Writes the new `mapConfig` into the site settings draft (null when no
  // group is set).
  onSave: (mapConfig: RouteMapConfigValue | null) => void;
  onClose: () => void;
}

const NO_PATH_HINT = "The site route has no path to draw.";

// Configures the site route's map (`settings.route.mapConfig`): a live
// preview of the route beside two groups of controls (Display, with a
// caption that points to the places in Site settings, and Controls).
// Full screen on phones and nearly the whole window on desktop. The
// dialog edits a draft of the config; every change rebuilds the
// preview's style through `eventRouteMapStyle`, which draws the route
// (GET /admin/routes/{id}/route-map) over the tracker map of the route
// view's event with its enabled MapLibre theme carrying the default flag
// for the Light or Dark toggle, and labels the places of the site
// settings draft (`places.routeMap.kinds`, none when absent). Save hands
// the config to `onSave` (null when no group is set), which writes it
// into the site settings draft; Cancel drops it; Clear all, after a
// confirm, hands null. With no path, no tracker map, or no enabled
// MapLibre theme the preview area holds only the hint.
export default function RouteMapConfigDialog({ routeId, mapConfig, places, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<RouteMapConfigValue>(() => toRouteMapConfig(mapConfig));
  const [appearance, setAppearance] = useState<Appearance>("light");
  const [terrainOn, setTerrainOn] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const mapsQ = useQuery({ queryKey: keys.maps, queryFn: () => mapsApi.list() });
  const themesQ = useQuery({ queryKey: keys.themes, queryFn: () => themesApi.list() });
  const eventsQ = useQuery({ queryKey: keys.events, queryFn: () => eventsApi.list() });
  const viewEvent = eventsQ.data ? routeViewEvent(eventsQ.data.items) : undefined;
  const source =
    mapsQ.data && themesQ.data && eventsQ.data
      ? eventRouteMapSource(
          viewEvent ?? { trackerMapId: null, trackerThemeIds: [] },
          mapsQ.data.items,
          themesQ.data.items,
          appearance
        )
      : null;
  const theme = source?.theme ?? null;
  const map = source?.map ?? null;
  const styleUrl = theme?.styleUrl ?? "";
  const bodyQ = useQuery({ ...themeStyleQuery(styleUrl), enabled: styleUrl !== "" });
  const terrainAvailable = !!map?.terrainUrl;

  const routeMapQ = useQuery({
    queryKey: keys.routeMap(routeId),
    queryFn: async () => toRouteMapData((await routesApi.routeMap(routeId)).routeMap),
  });
  const routeMap = routeMapQ.data ?? null;

  const poiKinds = useMemo(() => placesPart(places, "routeMap")?.kinds, [places]);
  const drawable = routeMap && routeMap.path.length > 0 ? routeMap : null;

  const terrainKept = readControl(draft.controls, "terrain");
  const body = bodyQ.data ?? null;
  const previewStyle = useMemo(
    () =>
      drawable && theme && map && body
        ? eventRouteMapStyle({
            theme: { overlay: theme.overlay, body },
            map,
            routeMap: drawable,
            routeMapConfig: draft,
            terrain: terrainOn && terrainAvailable,
            poiKinds,
          })
        : null,
    [drawable, theme, map, body, draft, terrainOn, terrainAvailable, poiKinds]
  );

  const set = <K extends keyof RouteMapConfigValue>(
    key: K,
    value: RouteMapConfigValue[K] | undefined
  ) => setDraft((d) => withGroup(d, key, value));

  const save = (next: RouteMapConfigValue | null) => {
    onSave(next);
    onClose();
  };

  const preview = (() => {
    if (source?.hint) return <Hint>{source.hint}</Hint>;
    const failed = routeMapQ.error ?? mapsQ.error ?? themesQ.error ?? eventsQ.error ?? bodyQ.error;
    if (failed) {
      return (
        <Alert severity="warning" data-testid="route-map-preview-hint">
          The preview could not load. {failed instanceof Error ? failed.message : ""}
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
    if (!drawable) return <Hint>{NO_PATH_HINT}</Hint>;
    if (!previewStyle) {
      return (
        <Box data-testid="route-map-preview-loading">
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Loading the preview
          </Typography>
          <LinearProgress />
        </Box>
      );
    }
    return (
      <RouteMapPreview
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
        onClose={onClose}
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
        <DialogTitleWithHelp id="route-map-config-title" help="site-settings.route">
          Route map settings
        </DialogTitleWithHelp>
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
            <Group title="Display">
              <RouteMapDisplayControls
                value={draft.display}
                onChange={(next) => set("display", next)}
                resettable
                testId="route-map-display"
                title="Route line and labels"
                help="Each setting shows the built-in default until you pick one."
              />
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ mt: 1 }}
                data-testid="route-map-places-caption"
              >
                Places are set for every map under Places on the maps in{" "}
                <Link component={RouterLink} to="/site-settings">
                  Site settings
                </Link>
                .
              </Typography>
            </Group>
            <Group title="Controls" last>
              <Stack spacing={1} data-testid="route-map-controls">
                {ROUTE_MAP_CONTROL_KEYS.map((key) => (
                  <Box key={key}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={readControl(draft.controls, key)}
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            color="error"
            onClick={() => setConfirmClear(true)}
            sx={{ mr: "auto" }}
          >
            Clear all
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={() => save(routeMapConfigBody(draft))}>
            Save
          </Button>
        </DialogActions>
      </AppDialog>
      <ConfirmDialog
        open={confirmClear}
        title="Clear the route map settings?"
        body="Every route map setting returns to its default."
        confirmLabel="Clear all"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          save(null);
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
