import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormHelperText,
  Grid,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/errors";
import { events as eventsApi } from "../../api/resources/events";
import { media as mediaApi } from "../../api/resources/media";
import { siteSettings as siteSettingsApi } from "../../api/resources/siteSettings";
import { UploadFailed, uploadToS3 } from "../../api/resources/upload";
import type { Event, MediaAsset, QrCode } from "../../api/types";
import { useConfig } from "../../ConfigContext";
import { useCompact } from "../../hooks/useCompact";
import { useNotify } from "../../hooks/useNotify";
import { keys } from "../../queries/keys";
import { RASTER_MAX_BYTES } from "../../validation/image";
import { browserTimeZone } from "../../lib/time";
import { routeBasemapBase, type Appearance } from "../../routeMap";
import {
  POSTER_PRESETS,
  posterFilename,
  posterSize,
  probeTerrain,
  renderPosterImage,
  POSTER_MIME,
  type PosterOrientation,
  type PosterPresetId,
  type RouteMapData,
} from "../../routeMap/poster";
import {
  ARROW_SCALES,
  DEFAULT_ARROWS,
  DEFAULT_ARROW_SCALE,
  DEFAULT_TIME_LABEL_FORMAT,
  DEFAULT_TIME_LABEL_INTERVAL,
  TIME_LABEL_FORMATS,
  TIME_LABEL_INTERVALS,
  buildPosterStyle,
  isHexColor,
  posterTimeLabels,
  themeRouteColor,
  type ArrowScale,
  type PosterStyleInput,
  type TimeLabelFormat,
  type TimeLabelInterval,
} from "../../routeMap/posterStyle";
import {
  elementLabel,
  parsePosterLayout,
  toLayoutDocument,
  type LayoutElement,
  type PosterLayout,
} from "../../routeMap/posterLayout";
import { renderOverlayCanvas } from "../../routeMap/posterOverlay";
import RoutePosterPreview, { PREVIEW_MAX_HEIGHT } from "./RoutePosterPreview";
import PosterOverlayComposer, { type EditorElement } from "./PosterOverlayComposer";
import PosterOverlayControls from "./PosterOverlayControls";
import { OverlayLoadError, sourceKey, useOverlaySources } from "./overlaySources";

interface Props {
  event: Event;
}

type Phase =
  | "idle"
  | "rendering"
  | "uploading"
  | "confirming"
  | "ready"
  | "setting"
  | "failed";

const NO_PATH_MESSAGE = "The linked flight recording has no path to draw.";

export const SIZE_LIMIT_MESSAGE =
  "The poster image is over the 20 MB limit for images. Choose a smaller size or the other theme and generate again.";

export const NO_SCHEDULE_HINT =
  "The event has no scheduled time, so the labels show the time since the start.";

// The width of a new overlay element over the poster's width.
const NEW_ELEMENT_WIDTH: Record<LayoutElement["type"], number> = {
  image: 0.25,
  logo: 0.2,
  qr: 0.15,
};

// The workspace of the poster studio page (admin.md 6.3). The working
// column holds a large live preview of the event's route map at the
// chosen theme, orientation, size, and route styling (colour, arrows,
// time labels), with the hillshade when Terrain is checked (offered only
// once the probe finds `<base>/terrain.pmtiles`), and the overlay composer
// over it (images, the site logo, QR codes). The controls sit in a rail on
// the right on desktop and stack under the preview below md. Mounting
// loads the event's saved poster layout; Save layout and a successful
// Generate save it. Generate renders the same style offscreen, draws the
// overlays over it at the print scale and the attribution last, uploads
// the JPEG through the media upload flow, and offers to set the ready
// asset as the route poster, which returns to the event page.
export default function PosterStudioWorkspace({ event }: Props) {
  const config = useConfig();
  const qc = useQueryClient();
  const notify = useNotify();
  const navigate = useNavigate();
  const compact = useCompact();
  const previewMaxHeight = usePreviewMaxHeight();
  const [theme, setTheme] = useState<Appearance>("light");
  const [orientation, setOrientation] = useState<PosterOrientation>("landscape");
  const [preset, setPreset] = useState<PosterPresetId>("facebook");
  const [terrain, setTerrain] = useState(false);
  const [terrainAvailable, setTerrainAvailable] = useState(false);
  // The picked route colour, or null for the theme's.
  const [customColor, setCustomColor] = useState<string | null>(null);
  // The hex field's text while it does not hold a complete colour.
  const [colorText, setColorText] = useState<string | null>(null);
  const [arrows, setArrows] = useState(DEFAULT_ARROWS);
  const [arrowScale, setArrowScale] = useState<ArrowScale>(DEFAULT_ARROW_SCALE);
  const [labelInterval, setLabelInterval] = useState<TimeLabelInterval>(
    DEFAULT_TIME_LABEL_INTERVAL,
  );
  const [format, setFormat] = useState<TimeLabelFormat>(DEFAULT_TIME_LABEL_FORMAT);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  // Each run gets an id; a run whose page was left or restarted stops
  // updating the state.
  const runRef = useRef(0);
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Set by Clear layout; with no elements left, saving sends null.
  const [cleared, setCleared] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const nextKey = useRef(0);
  // The event the page opened on; its layout loads once, on mount, so a
  // refetch after a save leaves the composer alone.
  const eventRef = useRef(event);
  eventRef.current = event;

  useEffect(() => {
    const runs = runRef;
    const saved = parsePosterLayout(eventRef.current.posterLayout);
    setElements(
      (saved?.elements ?? []).map((el) => ({ ...el, key: `el-${++nextKey.current}` })),
    );
    if (saved) {
      setCustomColor(saved.routeStyle.colour);
      setColorText(null);
      setArrows(saved.routeStyle.arrows);
      setArrowScale(saved.routeStyle.arrowScale);
      setLabelInterval(saved.routeStyle.labels.interval);
      setFormat(saved.routeStyle.labels.format);
    }
    return () => {
      runs.current += 1;
    };
  }, []);

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

  const eventId = Number(event.id);
  const year = Number(event.year);
  const size = useMemo(() => posterSize(preset, orientation), [preset, orientation]);
  const routeColor = customColor ?? themeRouteColor(theme);
  const scheduledAt = event.scheduledAt ?? null;
  const labelFormat: TimeLabelFormat = scheduledAt ? format : "elapsed";
  const zone = event.scheduleTimeZone || browserTimeZone();
  const withTerrain = terrain && terrainAvailable;
  const styling = useMemo<PosterStyling>(
    () => ({
      theme,
      terrain: withTerrain,
      routeColor,
      arrows,
      arrowScale,
      interval: labelInterval,
      format: labelFormat,
      scheduledAt,
      zone,
    }),
    [theme, withTerrain, routeColor, arrows, arrowScale, labelInterval, labelFormat, scheduledAt, zone],
  );

  const siteSettingsResult = useQuery({
    queryKey: keys.siteSettings,
    queryFn: () => siteSettingsApi.get(),
  });
  const logoMediaId = siteLogoId(siteSettingsResult.data?.data);

  const { states: sources, whenReady } = useOverlaySources(elements, config.siteBaseUrl);

  const routeMapQuery = {
    queryKey: keys.eventRouteMap(eventId),
    queryFn: async () => toRouteMapData((await eventsApi.routeMap(eventId)).routeMap),
  };
  const routeMapResult = useQuery(routeMapQuery);
  const routeMap = routeMapResult.data ?? null;

  const drawable = routeMap && routeMap.path.length > 0 ? routeMap : null;
  const previewStyle = useMemo(
    () => (drawable && base !== null ? posterStyle(config, drawable, styling) : null),
    [drawable, base, config, styling],
  );
  const busy =
    phase === "rendering" ||
    phase === "uploading" ||
    phase === "confirming" ||
    phase === "setting";

  const layoutDocument = (): PosterLayout | null =>
    cleared && elements.length === 0
      ? null
      : toLayoutDocument(
          { colour: customColor, arrows, arrowScale, labels: { interval: labelInterval, format } },
          elements,
        );

  // PATCHes the layout on the event; resolves whether it was saved.
  const saveLayout = async (): Promise<boolean> => {
    setLayoutError(null);
    setSavingLayout(true);
    try {
      await eventsApi.patch(eventId, { posterLayout: layoutDocument() });
    } catch (e) {
      setLayoutError(`The poster layout could not be saved. ${messageOf(e)}`);
      return false;
    } finally {
      setSavingLayout(false);
    }
    void qc.invalidateQueries({ queryKey: keys.event(eventId), exact: true });
    return true;
  };

  const addElement = (el: LayoutElement) => {
    const key = `el-${++nextKey.current}`;
    setElements((list) => [...list, { ...el, key }]);
    setSelectedKey(key);
    setCleared(false);
  };
  const placeNew = (type: LayoutElement["type"]) => ({
    x: 0.5,
    y: 0.5,
    width: NEW_ELEMENT_WIDTH[type],
    rotation: 0,
    z: elements.length,
  });
  const addImage = (picked: MediaAsset) => {
    if (typeof picked.id !== "string") return;
    qc.setQueryData(keys.mediaAsset(picked.id), picked);
    addElement({ type: "image", mediaId: picked.id, ...placeNew("image") });
  };
  const addLogo = (mediaId: string) => addElement({ type: "logo", mediaId, ...placeNew("logo") });
  const addQr = (code: QrCode) =>
    addElement({ type: "qr", qrId: code.id, tag: code.tag, ...placeNew("qr") });
  const moveElement = (key: string, placement: Pick<LayoutElement, "x" | "y" | "width" | "rotation">) =>
    setElements((list) => list.map((el) => (el.key === key ? { ...el, ...placement } : el)));
  const deleteElement = useCallback((key: string) => {
    setElements((list) => list.filter((el) => el.key !== key));
    setSelectedKey((k) => (k === key ? null : k));
  }, []);
  const selectedIndex = elements.findIndex((el) => el.key === selectedKey);
  const shift = (by: 1 | -1) => {
    const to = selectedIndex + by;
    if (selectedIndex < 0 || to < 0 || to >= elements.length) return;
    setElements((list) => {
      const next = [...list];
      [next[selectedIndex], next[to]] = [next[to]!, next[selectedIndex]!];
      return next;
    });
  };
  const clearLayout = () => {
    setElements([]);
    setSelectedKey(null);
    setCleared(true);
  };
  const failedOverlays = elements.flatMap((el) => {
    const state = sources[sourceKey(el)];
    if (state?.status !== "failed") return [];
    const filename =
      el.type === "image"
        ? (qc.getQueryData<MediaAsset>(keys.mediaAsset(el.mediaId))?.filename ?? null)
        : null;
    return [`The overlay ${elementLabel(el, filename)} could not load. ${state.error}`];
  });

  const generate = async () => {
    const run = ++runRef.current;
    const live = () => runRef.current === run;
    setError(null);
    setAsset(null);
    setProgress(0);
    setPhase("rendering");
    let blob: Blob;
    try {
      const data = routeMap ?? (await qc.fetchQuery(routeMapQuery));
      if (!data || data.path.length === 0) {
        throw new Error(NO_PATH_MESSAGE);
      }
      const loaded = await whenReady(elements);
      if (!live()) return;
      const overlay = elements.length > 0 ? renderOverlayCanvas(elements, loaded, size) : null;
      const style = posterStyle(config, data, styling);
      blob = await renderPosterImage({ style, path: data.path, size, theme, overlay });
    } catch (e) {
      if (live()) {
        fail(e instanceof OverlayLoadError ? e.message : `The poster could not be drawn. ${messageOf(e)}`);
      }
      return;
    }
    if (!live()) return;
    if (blob.size > RASTER_MAX_BYTES) {
      fail(SIZE_LIMIT_MESSAGE);
      return;
    }

    setPhase("uploading");
    const filename = posterFilename(year, theme, size);
    let ready: MediaAsset;
    try {
      const ticket = await mediaApi.uploadUrl({
        filename,
        contentType: POSTER_MIME,
        sizeBytes: blob.size,
        alt: `The ${year} route map`,
        title: `${event.name ?? year} route poster`,
      });
      const mediaId = typeof ticket.media?.id === "string" ? ticket.media.id : null;
      if (!ticket.uploadUrl || !mediaId) throw new Error("Upload ticket incomplete");
      if (!live()) return;
      const file = new File([blob], filename, { type: POSTER_MIME });
      await uploadToS3(ticket, file, (f) => {
        if (live()) setProgress(f);
      });
      if (!live()) return;
      setPhase("confirming");
      ready = await mediaApi.confirm(mediaId);
    } catch (e) {
      if (live()) fail(uploadMessage(e));
      return;
    }
    if (!live()) return;
    await saveLayout();
    if (!live()) return;
    setAsset(ready);
    setPhase("ready");
    void qc.invalidateQueries({ queryKey: ["media"] });
  };

  const setAsPoster = async () => {
    if (!asset || typeof asset.id !== "string") return;
    const run = runRef.current;
    setError(null);
    setPhase("setting");
    try {
      await eventsApi.patch(eventId, { routeImageMediaId: asset.id });
    } catch (e) {
      if (runRef.current === run) {
        setError(`The route poster could not be set. ${messageOf(e)}`);
        setPhase("ready");
      }
      return;
    }
    notify("Route poster updated");
    // The poster changes the event and the list only; the route map the
    // studio reads stays cached.
    void qc.invalidateQueries({ queryKey: keys.event(eventId), exact: true });
    void qc.invalidateQueries({ queryKey: keys.events, exact: true });
    navigate(`/events/${eventId}`);
  };

  function fail(message: string) {
    setError(message);
    setPhase("failed");
  }

  const assetId = asset && typeof asset.id === "string" ? asset.id : null;

  const ready = asset !== null && (phase === "ready" || phase === "setting");

  const preview =
    previewStyle && drawable ? (
      <RoutePosterPreview
        style={previewStyle}
        path={drawable.path}
        size={size}
        maxHeight={previewMaxHeight}
        overlay={(display) => (
          <PosterOverlayComposer
            width={display.width}
            height={display.height}
            elements={elements}
            sources={sources}
            selectedKey={selectedKey}
            disabled={busy}
            touch={compact}
            onSelect={setSelectedKey}
            onChange={moveElement}
            onDelete={deleteElement}
          />
        )}
      />
    ) : routeMapResult.isError ? (
      <Alert severity="warning" data-testid="route-poster-preview-error">
        The preview could not load. {messageOf(routeMapResult.error)}
      </Alert>
    ) : routeMapResult.isSuccess ? (
      <Alert severity="warning" data-testid="route-poster-preview-error">
        {NO_PATH_MESSAGE}
      </Alert>
    ) : (
      <Status label="Loading the preview" />
    );

  return (
    <Grid container spacing={3} data-testid="poster-studio-workspace">
      <Grid size={{ xs: 12, md: 8, lg: 9 }} data-testid="poster-studio-preview-column">
        <Stack spacing={2}>
          {preview}
          {failedOverlays.length > 0 ? (
            <Alert severity="warning" data-testid="poster-overlay-failed">
              {failedOverlays.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </Alert>
          ) : null}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 4, lg: 3 }} data-testid="poster-studio-rail">
        <Stack spacing={2}>
          <FormControl disabled={busy}>
            <FormLabel id="poster-theme">Theme</FormLabel>
            <RadioGroup
              row
              aria-labelledby="poster-theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as Appearance)}
            >
              <FormControlLabel value="light" control={<Radio />} label="Light" />
              <FormControlLabel value="dark" control={<Radio />} label="Dark" />
            </RadioGroup>
          </FormControl>
          <FormControl disabled={busy}>
            <FormLabel id="poster-orientation">Orientation</FormLabel>
            <RadioGroup
              row
              aria-labelledby="poster-orientation"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as PosterOrientation)}
            >
              <FormControlLabel value="portrait" control={<Radio />} label="Portrait" />
              <FormControlLabel value="landscape" control={<Radio />} label="Landscape" />
            </RadioGroup>
          </FormControl>
          <FormControl disabled={busy}>
            <FormLabel id="poster-size">Size</FormLabel>
            <RadioGroup
              aria-labelledby="poster-size"
              value={preset}
              onChange={(e) => setPreset(e.target.value as PosterPresetId)}
            >
              {POSTER_PRESETS.map((p) => {
                const s = posterSize(p.id, orientation);
                return (
                  <FormControlLabel
                    key={p.id}
                    value={p.id}
                    control={<Radio />}
                    label={`${p.label}, ${s.width} x ${s.height}`}
                  />
                );
              })}
            </RadioGroup>
          </FormControl>
          {terrainAvailable ? (
            <FormControlLabel
              disabled={busy}
              control={
                <Checkbox
                  checked={terrain}
                  onChange={(e) => setTerrain(e.target.checked)}
                  data-testid="route-poster-terrain"
                />
              }
              label="Terrain"
            />
          ) : null}
          <Stack spacing={2} component="fieldset" sx={{ border: 0, p: 0, m: 0 }} data-testid="route-poster-styling">
            <FormLabel component="legend">Route styling</FormLabel>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
              <Box
                component="input"
                type="color"
                aria-label="Route colour"
                data-testid="route-poster-color"
                value={routeColor}
                disabled={busy}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setCustomColor(e.target.value.toLowerCase());
                  setColorText(null);
                }}
                sx={{ width: 48, height: 40, p: 0, border: 0, bgcolor: "transparent", cursor: "pointer" }}
              />
              <TextField
                label="Hex"
                size="small"
                disabled={busy}
                value={colorText ?? routeColor}
                error={colorText !== null && !isHexColor(colorText)}
                onChange={(e) => {
                  const text = e.target.value.trim();
                  setColorText(text);
                  if (isHexColor(text)) setCustomColor(text.toLowerCase());
                }}
                onBlur={() => setColorText(null)}
                slotProps={{ htmlInput: { "data-testid": "route-poster-color-hex", maxLength: 7 } }}
                sx={{ width: 120 }}
              />
              <Button
                size="small"
                disabled={busy || customColor === null}
                onClick={() => {
                  setCustomColor(null);
                  setColorText(null);
                }}
                data-testid="route-poster-color-reset"
              >
                Reset
              </Button>
            </Stack>
            <FormControlLabel
              disabled={busy}
              control={
                <Switch
                  checked={arrows}
                  onChange={(e) => setArrows(e.target.checked)}
                  data-testid="route-poster-arrows"
                />
              }
              label="Arrows"
            />
            <FormControl size="small" disabled={busy || !arrows} sx={{ minWidth: 200 }}>
              <InputLabel id="poster-arrow-size">Arrow size</InputLabel>
              <Select
                labelId="poster-arrow-size"
                label="Arrow size"
                value={arrowScale}
                onChange={(e) => setArrowScale(Number(e.target.value) as ArrowScale)}
                data-testid="route-poster-arrow-size"
              >
                {ARROW_SCALES.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack spacing={2}>
              <FormControl size="small" disabled={busy} sx={{ minWidth: 200 }}>
                <InputLabel id="poster-time-labels">Time labels</InputLabel>
                <Select
                  labelId="poster-time-labels"
                  label="Time labels"
                  value={labelInterval}
                  onChange={(e) => setLabelInterval(Number(e.target.value) as TimeLabelInterval)}
                  data-testid="route-poster-time-labels"
                >
                  {TIME_LABEL_INTERVALS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl
                size="small"
                disabled={busy || labelInterval === 0 || !scheduledAt}
                sx={{ minWidth: 200 }}
              >
                <InputLabel id="poster-label-format">Label format</InputLabel>
                <Select
                  labelId="poster-label-format"
                  label="Label format"
                  value={labelFormat}
                  onChange={(e) => setFormat(e.target.value as TimeLabelFormat)}
                  data-testid="route-poster-label-format"
                >
                  {TIME_LABEL_FORMATS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
                {!scheduledAt ? (
                  <FormHelperText data-testid="route-poster-format-hint">{NO_SCHEDULE_HINT}</FormHelperText>
                ) : null}
              </FormControl>
            </Stack>
          </Stack>

          <PosterOverlayControls
            disabled={busy}
            logoMediaId={logoMediaId}
            selected={selectedIndex >= 0}
            canForward={selectedIndex >= 0 && selectedIndex < elements.length - 1}
            canBack={selectedIndex > 0}
            hasElements={elements.length > 0}
            saving={savingLayout}
            onAddImage={addImage}
            onAddLogo={addLogo}
            onAddQr={addQr}
            onForward={() => shift(1)}
            onBack={() => shift(-1)}
            onDelete={() => (selectedKey ? deleteElement(selectedKey) : undefined)}
            onClear={clearLayout}
            onSave={() => {
              void saveLayout().then((saved) => {
                if (saved) notify("Poster layout saved");
              });
            }}
          />
          {layoutError ? (
            <Alert severity="error" data-testid="poster-layout-error">
              {layoutError}
            </Alert>
          ) : null}

          <Typography variant="body2" color="text.secondary" data-testid="route-poster-output">
            {posterFilename(year, theme, size)}
          </Typography>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              variant={asset ? "outlined" : "contained"}
              onClick={() => void generate()}
              disabled={busy}
              data-testid="route-poster-generate-run"
            >
              {phase === "failed" ? "Try again" : asset ? "Generate another" : "Generate"}
            </Button>
            {ready ? (
              <Button
                variant="contained"
                onClick={() => void setAsPoster()}
                disabled={phase === "setting"}
                data-testid="route-poster-set"
              >
                Set as route poster
              </Button>
            ) : null}
          </Stack>
          {phase === "rendering" ? (
            <Status label="Rendering the map" />
          ) : phase === "uploading" ? (
            <Status label="Uploading" value={progress * 100} />
          ) : phase === "confirming" ? (
            <Status label="Processing the upload" />
          ) : phase === "setting" ? (
            <Status label="Setting the route poster" />
          ) : null}

          {error ? (
            <Alert severity="error" data-testid="route-poster-error">
              {error}
            </Alert>
          ) : null}

          {asset && ready ? (
            <Stack spacing={1} data-testid="route-poster-ready">
              <Alert severity="success">
                Ready: {asset.filename} ({asset.width} x {asset.height})
              </Alert>
              <PreviewImage asset={asset} />
              {assetId ? (
                <Link
                  component={RouterLink}
                  to={`/media?id=${encodeURIComponent(assetId)}`}
                  data-testid="route-poster-media-link"
                >
                  Open in the media library
                </Link>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Grid>
    </Grid>
  );
}

type PosterStyling = {
  theme: Appearance;
  terrain: boolean;
  routeColor: string;
  arrows: boolean;
  arrowScale: ArrowScale;
  interval: TimeLabelInterval;
  format: TimeLabelFormat;
  scheduledAt: string | null;
  zone: string;
};

// The poster style for the studio's choices. The preview and the export
// both draw through this one call.
function posterStyle(
  config: Parameters<typeof buildPosterStyle>[0],
  routeMap: RouteMapData,
  styling: PosterStyling,
) {
  const input: PosterStyleInput = {
    theme: styling.theme,
    routeMap,
    terrain: styling.terrain,
    options: {
      routeColor: styling.routeColor,
      arrows: styling.arrows,
      arrowScale: styling.arrowScale,
      timeLabels: posterTimeLabels(routeMap.timeline, {
        interval: styling.interval,
        format: styling.format,
        scheduledAt: styling.scheduledAt,
        zone: styling.zone,
      }),
    },
  };
  return buildPosterStyle(config, input);
}

// The space the shell's bar and the page header take above the preview,
// in CSS pixels.
const PREVIEW_CHROME = 200;

// The preview's height cap: the viewport's height under the bar and the
// header, never under the default cap, so the preview fills the working
// column and follows a window resize.
function usePreviewMaxHeight(): number {
  const [height, setHeight] = useState(previewMaxHeight);
  useEffect(() => {
    const update = () => setHeight(previewMaxHeight());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return height;
}

function previewMaxHeight(): number {
  return Math.max(PREVIEW_MAX_HEIGHT, window.innerHeight - PREVIEW_CHROME);
}

// The site logo's media id from the site settings draft, or null.
function siteLogoId(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const logo = (data as { logoMedia?: unknown }).logoMedia;
  if (typeof logo !== "object" || logo === null) return null;
  const id = (logo as { mediaId?: unknown }).mediaId;
  return typeof id === "string" && id ? id : null;
}

function Status({ label, value }: { label: string; value?: number }) {
  return (
    <Box data-testid="route-poster-status">
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <LinearProgress
        variant={value === undefined ? "indeterminate" : "determinate"}
        value={value}
      />
    </Box>
  );
}

function PreviewImage({ asset }: { asset: MediaAsset }) {
  const v480 =
    asset.variants && typeof asset.variants === "object"
      ? (asset.variants as Record<string, string>)["480"]
      : undefined;
  const url = v480 ?? asset.url ?? "";
  if (!url) return null;
  return (
    <Box
      component="img"
      src={url}
      alt={asset.alt ?? ""}
      sx={{ maxWidth: "100%", maxHeight: 240, objectFit: "contain", alignSelf: "flex-start" }}
    />
  );
}

function toRouteMapData(
  raw: Awaited<ReturnType<typeof eventsApi.routeMap>>["routeMap"],
): RouteMapData | null {
  if (!raw) return null;
  return {
    path: (raw.path ?? []).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
    timeline: (raw.timeline ?? []).map((t) => ({
      minutes: Number(t.minutes),
      lat: Number(t.lat),
      lng: Number(t.lng),
    })),
    durationMinutes: Number(raw.durationMinutes ?? 0),
  };
}

function messageOf(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Unknown error.";
}

function uploadMessage(e: unknown): string {
  if (
    (e instanceof ApiError && e.status === 413) ||
    (e instanceof UploadFailed && e.status === 413)
  ) {
    return SIZE_LIMIT_MESSAGE;
  }
  if (e instanceof UploadFailed) {
    return `The upload failed (${e.status === 0 ? "network error" : e.status}). Try again.`;
  }
  return `The upload failed. ${messageOf(e)}`;
}
