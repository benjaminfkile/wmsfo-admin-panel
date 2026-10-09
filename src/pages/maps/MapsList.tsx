import { useState } from "react";
import {
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import { maps as mapsApi } from "../../api/resources/maps";
import { keys } from "../../queries/keys";
import CommentBox from "../../components/CommentBox";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { formatBytes } from "../../lib/bytes";
import { useNotify } from "../../hooks/useNotify";
import CardTitle from "../../help/CardTitle";
import HelpButton from "../../help/HelpButton";
import MapRenameDialog from "./MapRenameDialog";
import type { TrackerMap } from "../../api/types";

const sourceBuildFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// "<west>, <south> to <east>, <north>" at two decimals.
function areaLabel(m: TrackerMap): string {
  const b = m.bbox;
  if (!b) return "";
  const d = (v: number | string | undefined) => Number(v ?? 0).toFixed(2);
  return `${d(b.west)}, ${d(b.south)} to ${d(b.east)}, ${d(b.north)}`;
}

// `sourceBuild` is a calendar date (YYYY-MM-DD), shown as "Oct 1, 2026".
function sourceBuildLabel(m: TrackerMap): string {
  if (!m.sourceBuild) return "none";
  const d = new Date(`${m.sourceBuild}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? m.sourceBuild : sourceBuildFormat.format(d);
}

function terrainLabel(m: TrackerMap): string {
  if (m.terrainBytes == null) return "none";
  const size = formatBytes(Number(m.terrainBytes));
  return m.terrainMaxZoom == null
    ? size
    : `${size} to zoom ${String(m.terrainMaxZoom)}`;
}

// The Maps page (admin.md 6.27): the tile packages the CLI uploaded,
// renamed and deleted here. The panel never uploads a map.
export default function MapsList() {
  const qc = useQueryClient();
  const notify = useNotify();
  const [renameFor, setRenameFor] = useState<TrackerMap | null>(null);
  const [deleteFor, setDeleteFor] = useState<TrackerMap | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    map: TrackerMap;
  } | null>(null);

  const mapsQ = useQuery({
    queryKey: keys.maps,
    queryFn: () => mapsApi.list(),
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      mapsApi.rename(id, name),
    onSuccess: () => {
      notify("Map renamed");
      void qc.invalidateQueries({ queryKey: keys.maps });
      setRenameFor(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({
      id,
      replacementId,
    }: {
      id: number;
      replacementId: number | null;
    }) => mapsApi.remove(id, replacementId),
    onSuccess: () => {
      notify("Map deleted");
      void qc.invalidateQueries({ queryKey: keys.maps });
      void qc.invalidateQueries({ queryKey: keys.events });
      setDeleteFor(null);
    },
  });

  const maps = [...(mapsQ.data?.items ?? [])].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "")
  );
  const events = eventsQ.data?.items ?? [];

  const usingEvents = (m: TrackerMap) =>
    events.filter(
      (e) => e.trackerMapId != null && Number(e.trackerMapId) === Number(m.id)
    );

  const columns: Column<TrackerMap>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (m) => m.name,
    },
    {
      key: "area",
      header: "Area",
      role: "subtitle",
      render: (m) => areaLabel(m),
    },
    {
      key: "state",
      header: "State",
      role: "chip",
      render: (m) =>
        m.state === "ready" ? (
          <Chip size="small" label="Ready" />
        ) : (
          <Chip size="small" color="warning" label="Pending" />
        ),
    },
    {
      key: "zooms",
      header: "Zooms",
      role: "line",
      render: (m) => `${String(m.minZoom)} to ${String(m.maxZoom)}`,
    },
    {
      key: "tiles",
      header: "Tiles",
      role: "line",
      render: (m) =>
        m.tilesBytes == null ? "none" : formatBytes(Number(m.tilesBytes)),
    },
    {
      key: "terrain",
      header: "Terrain",
      role: "line",
      render: (m) => terrainLabel(m),
    },
    {
      key: "sourceBuild",
      header: "Source build",
      role: "line",
      render: (m) => sourceBuildLabel(m),
    },
    {
      key: "events",
      header: "Events",
      role: "line",
      render: (m) => {
        const using = usingEvents(m);
        if (using.length === 0) return "none";
        return (
          <Tooltip title={using.map((e) => e.name).join(", ")}>
            <span data-testid={`map-events-${String(m.id)}`}>
              {using.length}
            </span>
          </Tooltip>
        );
      },
    },
  ];

  // The other ready maps a delete can repoint its events to.
  const replacementCandidates = (m: TrackerMap) =>
    maps
      .filter((x) => x.state === "ready" && Number(x.id) !== Number(m.id))
      .map((x) => ({ id: Number(x.id), name: x.name ?? `#${String(x.id)}` }));

  return (
    <>
      <PageHeader
        title="Maps"
        help="maps"
        actions={<HelpButton topic="maps.build" label="How to build a map" />}
      />
      <CommentBox>
        Tile packages built for an area. An event with a map draws the tracker
        with MapLibre; an event without one uses Google Maps.
      </CommentBox>

      {mapsQ.error ? (
        <ErrorAlert error={mapsQ.error} />
      ) : (
        <Stack spacing={1}>
          <CardTitle variant="subtitle1" help="maps.list">
            Tile packages
          </CardTitle>
          <ResponsiveTable<TrackerMap>
            rows={maps}
            columns={columns}
            rowKey={(m) => String(m.id)}
            rowTestId={(m) => `map-row-${String(m.id)}`}
            emptyText="No maps yet."
            actions={(m) => (
              <IconButton
                size="small"
                aria-label={`Actions for ${m.name ?? "map"}`}
                onClick={(ev) => setMenuAnchor({ el: ev.currentTarget, map: m })}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
            audit={(m) => ({
              entity: "tracker_map",
              entityId: m.id ?? "",
              name: m.name ?? "map",
              audit: m.audit,
            })}
          />
        </Stack>
      )}

      {menuAnchor ? (
        <Menu open anchorEl={menuAnchor.el} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              renameMut.reset();
              setRenameFor(menuAnchor.map);
              setMenuAnchor(null);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem
            onClick={() => {
              deleteMut.reset();
              setDeleteFor(menuAnchor.map);
              setMenuAnchor(null);
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      ) : null}

      {renameFor ? (
        <MapRenameDialog
          name={renameFor.name ?? ""}
          submitting={renameMut.isPending}
          error={renameMut.error}
          onCancel={() => setRenameFor(null)}
          onSubmit={(name) =>
            renameMut.mutate({ id: Number(renameFor.id), name })
          }
        />
      ) : null}

      {deleteFor ? (
        <DeleteDialog
          open
          resource="maps"
          id={Number(deleteFor.id)}
          name={deleteFor.name ?? "map"}
          help="maps.delete"
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
