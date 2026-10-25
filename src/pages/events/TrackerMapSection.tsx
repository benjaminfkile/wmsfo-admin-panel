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
  Stack,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi, type PatchEventBody } from "../../api/resources/events";
import { themes as themesApi } from "../../api/resources/themes";
import type { Event, TrackerTheme } from "../../api/types";
import { keys } from "../../queries/keys";
import TrackerAreaField from "../../components/events/TrackerAreaField";
import StartViewField from "../../components/events/StartViewField";
import {
  sameStartView,
  startViewInside,
  toStartView,
  type StartView,
} from "../../components/events/startView";
import {
  MISSOULA_VALLEY_BBOX,
  bboxValid,
  sameBbox,
  toBbox,
  type Bbox,
} from "../../components/bbox/bbox";
import ErrorAlert from "../../components/ErrorAlert";
import ThemeThumb from "../../components/ThemeThumb";
import CardTitle from "../../help/CardTitle";
import HelpButton from "../../help/HelpButton";
import { useNotify } from "../../hooks/useNotify";
import { fieldErrorFor } from "../../lib/fieldErrors";

interface Props {
  event: Event;
}

type Draft = {
  bbox: Bbox;
  mapId: number | null;
  startView: StartView | null;
  themeIds: number[];
};

function draftOf(event: Event): Draft {
  return {
    bbox: toBbox(event.trackerBbox) ?? MISSOULA_VALLEY_BBOX,
    mapId: event.trackerMapId == null ? null : Number(event.trackerMapId),
    startView: toStartView(event.trackerStartView),
    themeIds: (event.trackerThemeIds ?? []).map(Number),
  };
}

function sameIds(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((id) => s.has(id));
}

function bySortOrder(a: TrackerTheme, b: TrackerTheme): number {
  return Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
}

// The Tracker map card on the event detail page (admin.md 6.3): a draft
// of the event's `trackerBbox`, `trackerMapId`, `trackerStartView`, and
// `trackerThemeIds` with one Save that sends only the changed fields. The
// map and the box are one choice, TrackerAreaField: the box comes from the
// map and stays inside its area. The start view sits under it,
// StartViewField, its centre inside the box, null when cleared. The Themes checklist holds the Google and MapLibre
// groups and needs one Google theme.
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

  const themesQ = useQuery({ queryKey: keys.themes, queryFn: () => themesApi.list() });

  const themes = useMemo(() => [...(themesQ.data?.items ?? [])].sort(bySortOrder), [themesQ.data]);
  const googleThemes = themes.filter((t) => t.renderer === "google");
  const maplibreThemes = themes.filter((t) => t.renderer === "maplibre");

  const noGoogle = !googleThemes.some((t) => draft.themeIds.includes(Number(t.id)));
  // Before the themes load the stored set stands.
  const googleMissing = themesQ.data !== undefined && noGoogle;

  const changed: PatchEventBody = {};
  if (!sameBbox(draft.bbox, saved.bbox)) changed.trackerBbox = draft.bbox;
  if (draft.mapId !== saved.mapId) changed.trackerMapId = draft.mapId;
  if (!sameStartView(draft.startView, saved.startView)) changed.trackerStartView = draft.startView;
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
  const startViewError = fieldErrorFor(saveMut.error, "trackerStartView");
  const startViewOk = draft.startView === null || startViewInside(draft.startView, draft.bbox);

  // A legacy row whose box lies outside its map shows the editor's
  // message, and the API's on save.
  const canSave =
    dirty && bboxValid(draft.bbox) && startViewOk && !googleMissing && !saveMut.isPending;

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
          The tracker&apos;s area, start view, basemap, and looks for this event.
        </Typography>
        {saveMut.error ? (
          <ErrorAlert
            error={saveMut.error}
            handledFields={["trackerBbox", "trackerMapId", "trackerStartView", "trackerThemeIds"]}
          />
        ) : null}
        <Stack spacing={3}>
          <TrackerAreaField
            value={{ mapId: draft.mapId, bbox: draft.bbox }}
            onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
            exportName={event.name ?? "Event"}
            bboxHelp="events.detail.tracker-map.bbox"
            mapHelp="events.detail.tracker-map.map"
            bboxError={bboxError}
            mapError={mapError}
          />

          <StartViewField
            value={draft.startView}
            onChange={(startView) => setDraft((d) => ({ ...d, startView }))}
            bbox={draft.bbox}
            error={startViewError}
          />

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
