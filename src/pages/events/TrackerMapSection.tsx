import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  FormHelperText,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi, type PatchEventBody } from "../../api/resources/events";
import { maps as mapsApi } from "../../api/resources/maps";
import { themes as themesApi } from "../../api/resources/themes";
import { media as mediaApi } from "../../api/resources/media";
import { siteSettings as siteSettingsApi } from "../../api/resources/siteSettings";
import type { Event, TrackerMap, TrackerTheme } from "../../api/types";
import { keys } from "../../queries/keys";
import BboxEditor from "../../components/bbox/BboxEditor";
import {
  MISSOULA_VALLEY_BBOX,
  bboxContains,
  bboxValid,
  sameBbox,
  siteDefaultBbox,
  toBbox,
  type Bbox,
} from "../../components/bbox/bbox";
import ErrorAlert from "../../components/ErrorAlert";
import CardTitle from "../../help/CardTitle";
import HelpButton from "../../help/HelpButton";
import { useNotify } from "../../hooks/useNotify";
import { fieldErrorFor } from "../../lib/fieldErrors";

interface Props {
  event: Event;
}

type Draft = { bbox: Bbox; mapId: number | null; themeIds: number[] };

function draftOf(event: Event): Draft {
  return {
    bbox: toBbox(event.trackerBbox) ?? MISSOULA_VALLEY_BBOX,
    mapId: event.trackerMapId == null ? null : Number(event.trackerMapId),
    themeIds: (event.trackerThemeIds ?? []).map(Number),
  };
}

function sameIds(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((id) => s.has(id));
}

function covers(map: TrackerMap, box: Bbox): boolean {
  const b = toBbox(map.bbox);
  return b !== null && bboxContains(b, box);
}

function bySortOrder(a: TrackerTheme, b: TrackerTheme): number {
  return Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
}

// The theme's thumbnail: the `480` variant of its media asset at 48 px,
// or a swatch of its chrome `bg` and `accent` when it has none.
function ThemeThumb({ theme }: { theme: TrackerTheme }) {
  const mediaId = theme.thumbnailMediaId ?? "";
  const q = useQuery({
    queryKey: keys.mediaAsset(mediaId),
    queryFn: () => mediaApi.get(mediaId),
    enabled: mediaId !== "",
    staleTime: Infinity,
    retry: false,
  });
  const v480 = q.data?.variants?.["480"];
  const src = typeof v480 === "string" && v480 !== "" ? v480 : q.data?.url;
  if (mediaId !== "" && src) {
    return (
      <Box
        component="img"
        src={src}
        alt=""
        data-testid={`theme-thumb-${String(theme.id)}`}
        sx={{ width: 48, height: 48, objectFit: "cover", borderRadius: 0.5, flexShrink: 0 }}
      />
    );
  }
  return (
    <Box
      data-testid={`theme-swatch-${String(theme.id)}`}
      sx={{
        width: 48,
        height: 48,
        borderRadius: 0.5,
        flexShrink: 0,
        border: 1,
        borderColor: "divider",
        background: `linear-gradient(135deg, ${theme.chrome?.bg ?? "#ffffff"} 50%, ${
          theme.chrome?.accent ?? "#000000"
        } 50%)`,
      }}
    />
  );
}

// The Tracker map card on the event detail page (admin.md 6.3): a draft
// of the event's `trackerBbox`, `trackerMapId`, and `trackerThemeIds`
// with one Save that sends only the changed fields. The box is edited by
// BboxEditor with "Use site default"; the Map select offers the ready
// maps whose package contains the box; the Themes checklist holds the
// Google and MapLibre groups and needs one Google theme.
export default function TrackerMapSection({ event }: Props) {
  const qc = useQueryClient();
  const notify = useNotify();
  const eventId = Number(event.id);
  // The stored values as a string, so a refetch that changes nothing
  // keeps the draft.
  const savedKey = JSON.stringify(draftOf(event));
  const saved = useMemo(() => JSON.parse(savedKey) as Draft, [savedKey]);
  const [draft, setDraft] = useState<Draft>(saved);

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const mapsQ = useQuery({ queryKey: keys.maps, queryFn: () => mapsApi.list() });
  const themesQ = useQuery({ queryKey: keys.themes, queryFn: () => themesApi.list() });
  const settingsQ = useQuery({
    queryKey: keys.siteSettings,
    queryFn: () => siteSettingsApi.get(),
  });

  const readyMaps = useMemo(
    () =>
      (mapsQ.data?.items ?? [])
        .filter((m) => m.state === "ready")
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [mapsQ.data],
  );
  const themes = useMemo(() => [...(themesQ.data?.items ?? [])].sort(bySortOrder), [themesQ.data]);
  const googleThemes = themes.filter((t) => t.renderer === "google");
  const maplibreThemes = themes.filter((t) => t.renderer === "maplibre");

  const chosenMap =
    draft.mapId === null
      ? null
      : ((mapsQ.data?.items ?? []).find((m) => Number(m.id) === draft.mapId) ?? null);
  const mapUncovered = chosenMap !== null && !covers(chosenMap, draft.bbox);
  const noGoogle = !googleThemes.some((t) => draft.themeIds.includes(Number(t.id)));
  // Before the themes load the stored set stands.
  const googleMissing = themesQ.data !== undefined && noGoogle;

  const changed: PatchEventBody = {};
  if (!sameBbox(draft.bbox, saved.bbox)) changed.trackerBbox = draft.bbox;
  if (draft.mapId !== saved.mapId) changed.trackerMapId = draft.mapId;
  if (!sameIds(draft.themeIds, saved.themeIds)) changed.trackerThemeIds = draft.themeIds;
  const dirty = Object.keys(changed).length > 0;

  const saveMut = useMutation({
    mutationFn: (body: PatchEventBody) => eventsApi.patch(eventId, body),
    onSuccess: (row) => {
      notify("Tracker map saved");
      qc.setQueryData(keys.event(eventId), row);
      void qc.invalidateQueries({ queryKey: keys.event(eventId) });
      void qc.invalidateQueries({ queryKey: keys.events, exact: true });
      void qc.invalidateQueries({ queryKey: keys.maps });
    },
  });

  const bboxError = fieldErrorFor(saveMut.error, "trackerBbox");
  const mapError = fieldErrorFor(saveMut.error, "trackerMapId");
  const themesError = fieldErrorFor(saveMut.error, "trackerThemeIds");

  const canSave =
    dirty && bboxValid(draft.bbox) && !mapUncovered && !googleMissing && !saveMut.isPending;

  const toggleTheme = (id: number, on: boolean) =>
    setDraft((d) => ({
      ...d,
      themeIds: on ? [...d.themeIds.filter((t) => t !== id), id] : d.themeIds.filter((t) => t !== id),
    }));

  const themeGroup = (title: string, list: TrackerTheme[], footer: ReactNode) => (
    <Box data-testid={`tracker-themes-${title === "Google Maps" ? "google" : "maplibre"}`}>
      <Typography variant="subtitle2" sx={{ mt: 1 }}>
        {title}
      </Typography>
      {list.map((t) => {
        const id = Number(t.id);
        return (
          <FormControlLabel
            key={id}
            sx={{ display: "flex", my: 0.5, mr: 0 }}
            control={
              <Checkbox
                checked={draft.themeIds.includes(id)}
                onChange={(_, on) => toggleTheme(id, on)}
                inputProps={{ "aria-label": t.name ?? "" }}
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <ThemeThumb theme={t} />
                <Typography variant="body2">{t.name}</Typography>
                {t.defaultLightMode ? <Chip size="small" label="Light default" /> : null}
                {t.defaultDarkMode ? <Chip size="small" label="Dark default" /> : null}
              </Stack>
            }
          />
        );
      })}
      {footer}
    </Box>
  );

  return (
    <Card data-testid="tracker-map-card">
      <CardContent>
        <CardTitle help="events.detail.tracker-map" sx={{ mb: 1 }}>
          Tracker map
        </CardTitle>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The tracker&apos;s area, basemap, and looks for this event.
        </Typography>
        {saveMut.error ? (
          <ErrorAlert
            error={saveMut.error}
            handledFields={["trackerBbox", "trackerMapId", "trackerThemeIds"]}
          />
        ) : null}
        <Stack spacing={3}>
          <Box>
            <BboxEditor
              label="Tracker area"
              value={draft.bbox}
              onChange={(bbox) => setDraft((d) => ({ ...d, bbox }))}
              exportName={event.name ?? "Event"}
              help="events.detail.tracker-map.bbox"
              error={bboxError}
            />
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() =>
                setDraft((d) => ({ ...d, bbox: siteDefaultBbox(settingsQ.data?.data) }))
              }
            >
              Use site default
            </Button>
          </Box>

          <Box>
            <Stack direction="row" spacing={0.5} alignItems="flex-start">
              <TextField
                select
                fullWidth
                label="Map"
                value={draft.mapId === null ? "" : String(draft.mapId)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    mapId: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                error={mapUncovered || mapError !== null}
                SelectProps={{ displayEmpty: true }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ "data-testid": "tracker-map-select" }}
              >
                <MenuItem value="">No map</MenuItem>
                {readyMaps.map((m) => {
                  const ok = covers(m, draft.bbox);
                  return (
                    <MenuItem key={String(m.id)} value={String(m.id)} disabled={!ok}>
                      <ListItemText
                        primary={m.name}
                        secondary={
                          ok
                            ? m.terrainUrl
                              ? "With terrain"
                              : "No terrain"
                            : "does not cover the box"
                        }
                      />
                    </MenuItem>
                  );
                })}
              </TextField>
              <Box sx={{ pt: 1 }}>
                <HelpButton topic="events.detail.tracker-map.map" />
              </Box>
            </Stack>
            {mapUncovered && chosenMap ? (
              <FormHelperText error data-testid="tracker-map-uncovered">
                The map {chosenMap.name} does not cover this area. Choose another map or widen the
                area.
              </FormHelperText>
            ) : null}
            {mapError ? <FormHelperText error>{mapError}</FormHelperText> : null}
            <FormHelperText data-testid="tracker-map-note">
              {draft.mapId === null
                ? "No map: every viewer gets Google Maps, locked to the box"
                : "Viewers whose browser can draw this map get it; the rest get Google Maps, locked to the box"}
            </FormHelperText>
          </Box>

          <Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="subtitle1">Themes</Typography>
              <HelpButton topic="events.detail.tracker-map.themes" />
            </Stack>
            {themeGroup(
              "Google Maps",
              googleThemes,
              googleMissing ? (
                <FormHelperText error>Enable at least one Google theme</FormHelperText>
              ) : null,
            )}
            {themeGroup("MapLibre", maplibreThemes, null)}
            {themesError ? <FormHelperText error>{themesError}</FormHelperText> : null}
          </Box>

          <Box>
            <Button
              variant="contained"
              disabled={!canSave}
              onClick={() => saveMut.mutate(changed)}
              data-testid="tracker-map-save"
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
