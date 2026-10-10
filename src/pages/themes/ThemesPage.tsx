import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import { themes as themesApi } from "../../api/resources/themes";
import { keys } from "../../queries/keys";
import CommentBox from "../../components/CommentBox";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import HelpButton from "../../help/HelpButton";
import { useCompact } from "../../hooks/useCompact";
import { useNotify } from "../../hooks/useNotify";
import { useConfig } from "../../ConfigContext";
import { forMaputnik } from "../../routeMap";
import { loadThemeStyle } from "../../routeMap/themeStyle";
import ThemeCard from "./ThemeCard";
import ThemeEditorDialog from "./ThemeEditorDialog";
import { downloadStarterStyle, downloadStyle } from "./starterStyle";
import { bySortOrder, sortOrderPatches } from "./themeOrder";
import type { TrackerTheme } from "../../api/types";

type Renderer = "google" | "maplibre";

const GROUPS: Array<{ renderer: Renderer; title: string }> = [
  { renderer: "google", title: "Google Maps" },
  { renderer: "maplibre", title: "MapLibre" },
];

// The Tracker themes page (admin.md 6.28): the Google Maps and MapLibre
// groups of theme cards, each reordered by drag, with New theme, the
// starter style download, the per-theme style download, and the delete
// with a replacement.
export default function ThemesPage() {
  const qc = useQueryClient();
  const notify = useNotify();
  const config = useConfig();
  const compact = useCompact();
  const [editing, setEditing] = useState<{ theme: TrackerTheme | null } | null>(
    null
  );
  const [deleteFor, setDeleteFor] = useState<TrackerTheme | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    theme: TrackerTheme;
  } | null>(null);

  const themesQ = useQuery({
    queryKey: keys.themes,
    queryFn: () => themesApi.list(),
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  // The order on screen, by renderer, so a drop shows at once while
  // its patches are in flight.
  const [order, setOrder] = useState<Record<Renderer, TrackerTheme[]>>({
    google: [],
    maplibre: [],
  });
  useEffect(() => {
    const items = themesQ.data?.items ?? [];
    setOrder({
      google: items.filter((t) => t.renderer === "google").sort(bySortOrder),
      maplibre: items.filter((t) => t.renderer === "maplibre").sort(bySortOrder),
    });
  }, [themesQ.data]);

  const usedBy = useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of eventsQ.data?.items ?? []) {
      for (const id of e.trackerThemeIds ?? []) {
        counts.set(Number(id), (counts.get(Number(id)) ?? 0) + 1);
      }
    }
    return counts;
  }, [eventsQ.data]);

  const reorderMut = useMutation({
    mutationFn: (patches: Array<{ id: number; sortOrder: number }>) =>
      Promise.all(
        patches.map((p) => themesApi.patch(p.id, { sortOrder: p.sortOrder }))
      ),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.themes });
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({
      id,
      replacementId,
    }: {
      id: number;
      replacementId: number | null;
    }) => themesApi.remove(id, replacementId),
    onSuccess: () => {
      notify("Theme deleted");
      void qc.invalidateQueries({ queryKey: keys.themes });
      void qc.invalidateQueries({ queryKey: keys.events });
      setDeleteFor(null);
    },
  });

  // A theme's body as `<key>.json`: a MapLibre body through
  // `forMaputnik`, a Google array as it is.
  const downloadMut = useMutation({
    mutationFn: async (t: TrackerTheme) => {
      const style: unknown = await loadThemeStyle(t.styleUrl ?? "");
      return { t, style };
    },
    onSuccess: ({ t, style }) => {
      downloadStyle(
        t.renderer === "maplibre"
          ? forMaputnik(style as Parameters<typeof forMaputnik>[0], config)
          : style,
        `${t.key}.json`
      );
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Download failed", "error"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = (renderer: Renderer) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = order[renderer];
    const from = list.findIndex((t) => Number(t.id) === Number(active.id));
    const to = list.findIndex((t) => Number(t.id) === Number(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(list, from, to);
    const patches = sortOrderPatches(next);
    const values = new Map(patches.map((p) => [p.id, p.sortOrder]));
    setOrder((o) => ({
      ...o,
      [renderer]: next.map((t) =>
        values.has(Number(t.id))
          ? { ...t, sortOrder: values.get(Number(t.id)) }
          : t
      ),
    }));
    if (patches.length > 0) reorderMut.mutate(patches);
  };

  // The other themes of the same renderer a delete can hand its events
  // and default flags to.
  const replacementCandidates = (t: TrackerTheme) =>
    (themesQ.data?.items ?? [])
      .filter((x) => x.renderer === t.renderer && Number(x.id) !== Number(t.id))
      .sort(bySortOrder)
      .map((x) => ({ id: Number(x.id), name: x.name ?? `#${String(x.id)}` }));

  return (
    <>
      <PageHeader
        title="Tracker themes"
        help="themes"
        actions={
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setEditing({ theme: null })}
            >
              New theme
            </Button>
            <Stack direction="row" alignItems="center">
              <Button
                startIcon={<DownloadIcon />}
                onClick={() => downloadStarterStyle(config)}
              >
                Download starter style
              </Button>
              <HelpButton topic="themes.starter-style" />
            </Stack>
          </Stack>
        }
      />
      <CommentBox>
        The looks visitors can pick on the tracker. A theme belongs to one
        renderer: Google Maps, or MapLibre over a map. Events choose which
        themes they offer.
      </CommentBox>

      {themesQ.error ? <ErrorAlert error={themesQ.error} /> : null}
      {reorderMut.error ? <ErrorAlert error={reorderMut.error} /> : null}

      <Stack
        direction={compact ? "column" : "row"}
        spacing={2}
        alignItems="flex-start"
        data-testid="themes-groups"
        data-layout={compact ? "stacked" : "side-by-side"}
      >
        {GROUPS.map((g) => {
          const list = order[g.renderer];
          return (
            <Box
              key={g.renderer}
              data-testid={`themes-group-${g.renderer}`}
              sx={{ flex: 1, minWidth: 0, width: compact ? "100%" : undefined }}
            >
              <Typography variant="subtitle1" component="h2" sx={{ mb: 1 }}>
                {g.title}
              </Typography>
              {list.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No themes yet.
                </Typography>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd(g.renderer)}
                >
                  <SortableContext
                    items={list.map((t) => Number(t.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    <Stack spacing={1}>
                      {list.map((t) => (
                        <ThemeCard
                          key={String(t.id)}
                          theme={t}
                          eventCount={usedBy.get(Number(t.id)) ?? 0}
                          disabled={reorderMut.isPending}
                          onEdit={() => setEditing({ theme: t })}
                          onMenu={(el) => setMenuAnchor({ el, theme: t })}
                        />
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
              )}
            </Box>
          );
        })}
      </Stack>

      {menuAnchor ? (
        <Menu open anchorEl={menuAnchor.el} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            disabled={!menuAnchor.theme.styleUrl}
            onClick={() => {
              downloadMut.mutate(menuAnchor.theme);
              setMenuAnchor(null);
            }}
          >
            Download style
          </MenuItem>
          <MenuItem
            onClick={() => {
              deleteMut.reset();
              setDeleteFor(menuAnchor.theme);
              setMenuAnchor(null);
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      ) : null}

      {editing ? (
        <ThemeEditorDialog
          theme={editing.theme}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleteFor ? (
        <DeleteDialog
          open
          resource="themes"
          id={Number(deleteFor.id)}
          name={deleteFor.name ?? "theme"}
          help="themes.delete"
          replacement={{
            label: "Replace with",
            candidates: replacementCandidates(deleteFor),
          }}
          disabled={deleteMut.isPending}
          error={deleteMut.error}
          onCancel={() => setDeleteFor(null)}
          onConfirm={({ replacementId }) =>
            deleteMut.mutate({ id: Number(deleteFor.id), replacementId })
          }
        />
      ) : null}
    </>
  );
}
