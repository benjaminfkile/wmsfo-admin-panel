import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Link,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/errors";
import { events as eventsApi } from "../../api/resources/events";
import { media as mediaApi } from "../../api/resources/media";
import { UploadFailed, uploadToS3 } from "../../api/resources/upload";
import type { Event, MediaAsset } from "../../api/types";
import AppDialog from "../../components/AppDialog";
import { useConfig } from "../../ConfigContext";
import { useNotify } from "../../hooks/useNotify";
import { keys } from "../../queries/keys";
import { RASTER_MAX_BYTES } from "../../validation/image";
import { buildRouteMapStyle, routeBasemapBase, type Appearance } from "../../routeMap";
import {
  POSTER_PRESETS,
  fiveMinuteMarks,
  posterFilename,
  posterSize,
  probeTerrain,
  renderPosterImage,
  POSTER_MIME,
  type PosterOrientation,
  type PosterPresetId,
  type RouteMapData,
} from "../../routeMap/poster";

interface Props {
  event: Event;
  open: boolean;
  onClose: () => void;
}

type Phase =
  | "idle"
  | "rendering"
  | "uploading"
  | "confirming"
  | "ready"
  | "setting"
  | "failed";

export const SIZE_LIMIT_MESSAGE =
  "The poster image is over the 20 MB limit for images. Choose a smaller size or the other theme and generate again.";

// The generator dialog of the route poster section (admin.md 6.3). Renders
// the event's route map at the chosen theme, orientation, and size, with
// the hillshade when Terrain is checked (offered only once the probe finds
// `<base>/terrain.pmtiles`), uploads
// the PNG through the media upload flow, and offers to set the ready asset
// as the route poster.
export default function RoutePosterGenerator({ event, open, onClose }: Props) {
  const config = useConfig();
  const qc = useQueryClient();
  const notify = useNotify();
  const [theme, setTheme] = useState<Appearance>("light");
  const [orientation, setOrientation] = useState<PosterOrientation>("landscape");
  const [preset, setPreset] = useState<PosterPresetId>("facebook");
  const [terrain, setTerrain] = useState(false);
  const [terrainAvailable, setTerrainAvailable] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<MediaAsset | null>(null);
  // Each run gets an id; a run whose dialog was closed or restarted stops
  // updating the state.
  const runRef = useRef(0);

  useEffect(() => {
    if (!open) {
      runRef.current += 1;
      setPhase("idle");
      setError(null);
      setAsset(null);
      setProgress(0);
    }
  }, [open]);

  const base = routeBasemapBase(config);
  useEffect(() => {
    if (!open || base === null) return;
    let active = true;
    void probeTerrain(base).then((found) => {
      if (active) setTerrainAvailable(found);
    });
    return () => {
      active = false;
    };
  }, [open, base]);

  const eventId = Number(event.id);
  const year = Number(event.year);
  const size = posterSize(preset, orientation);
  const busy =
    phase === "rendering" ||
    phase === "uploading" ||
    phase === "confirming" ||
    phase === "setting";

  const generate = async () => {
    const run = ++runRef.current;
    const live = () => runRef.current === run;
    setError(null);
    setAsset(null);
    setProgress(0);
    setPhase("rendering");
    let blob: Blob;
    try {
      const res = await eventsApi.routeMap(eventId);
      const routeMap = toRouteMapData(res.routeMap);
      if (!routeMap || routeMap.path.length === 0) {
        throw new Error("The linked flight recording has no path to draw.");
      }
      const style = buildRouteMapStyle(
        config,
        theme,
        routeMap.path,
        fiveMinuteMarks(routeMap),
        terrain && terrainAvailable,
      );
      blob = await renderPosterImage({ style, path: routeMap.path, size, theme });
    } catch (e) {
      if (live()) fail(`The poster could not be drawn. ${messageOf(e)}`);
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
    void qc.invalidateQueries({ queryKey: keys.event(eventId) });
    void qc.invalidateQueries({ queryKey: keys.events });
    onClose();
  };

  function fail(message: string) {
    setError(message);
    setPhase("failed");
  }

  const assetId = asset && typeof asset.id === "string" ? asset.id : null;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      data-testid="route-poster-generator"
    >
      <DialogTitle>Generate from flight recording</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
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
          <Typography variant="body2" color="text.secondary" data-testid="route-poster-output">
            {posterFilename(year, theme, size)}
          </Typography>

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

          {asset && (phase === "ready" || phase === "setting") ? (
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
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={onClose}>Close</Button>
        {asset && (phase === "ready" || phase === "setting") ? (
          <Button
            variant="contained"
            onClick={() => void setAsPoster()}
            disabled={phase === "setting"}
            data-testid="route-poster-set"
          >
            Set as route poster
          </Button>
        ) : null}
        <Button
          variant={asset ? "outlined" : "contained"}
          onClick={() => void generate()}
          disabled={busy}
          data-testid="route-poster-generate-run"
        >
          {phase === "failed" ? "Try again" : asset ? "Generate another" : "Generate"}
        </Button>
      </DialogActions>
    </AppDialog>
  );
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
