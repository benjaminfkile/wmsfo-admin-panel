import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { places as placesApi } from "../../api/resources/places";
import { pages as pagesApi } from "../../api/resources/pages";
import { keys } from "../../queries/keys";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { useNotify } from "../../hooks/useNotify";
import { useAuth } from "../../auth/AuthProvider";
import type { Place } from "../../api/types";
import PlaceDialog, { type PlaceDialogValues } from "./PlaceDialog";
import { locationCellFor, toTree } from "./placeHelpers";

type PlaceTreeRow = {
  place: Place;
  depth: number;
  childCount: number;
  isCollapsed: boolean;
};

export default function PlacesList() {
  const qc = useQueryClient();
  const notify = useNotify();
  const { state } = useAuth();
  const isAdmin = state.kind === "member" && state.role === "admin";

  const listQ = useQuery({
    queryKey: keys.places,
    queryFn: () => placesApi.list(),
  });
  const pagesQ = useQuery({
    queryKey: keys.pages,
    queryFn: () => pagesApi.list(),
  });

  const rows = useMemo<Place[]>(() => listQ.data?.items ?? [], [listQ.data]);
  const byId = useMemo(() => {
    const m = new Map<number, Place>();
    for (const p of rows) m.set(p.id, p);
    return m;
  }, [rows]);
  const tree = useMemo(() => toTree(rows), [rows]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.places });
  };

  // Every row starts expanded per admin.md 6.24.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visibleRows = useMemo<PlaceTreeRow[]>(
    () =>
      tree
        .filter((r) => !r.ancestors.some((id) => collapsed.has(id)))
        .map((r) => ({
          place: r.place,
          depth: r.depth,
          childCount: r.childCount,
          isCollapsed: collapsed.has(r.place.id),
        })),
    [tree, collapsed],
  );

  const [createOpen, setCreateOpen] = useState<{ parentId: number | null } | null>(
    null,
  );
  const [moveTarget, setMoveTarget] = useState<Place | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Place | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    row: Place;
  } | null>(null);

  const createMut = useMutation({
    mutationFn: (v: PlaceDialogValues) => placesApi.create(v),
    onSuccess: () => {
      notify("Place created");
      invalidate();
      setCreateOpen(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Create failed", "error"),
  });

  const moveMut = useMutation({
    mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) =>
      placesApi.patch(id, { parentId }),
    onSuccess: () => {
      notify("Moved");
      invalidate();
      setMoveTarget(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Move failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => placesApi.remove(id),
    onSuccess: () => {
      notify("Deleted");
      invalidate();
    },
    onSettled: () => setConfirmDelete(null),
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const columns: Column<PlaceTreeRow>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (r) => (
        <RouterLink to={`/places/${r.place.id}`}>{r.place.name}</RouterLink>
      ),
    },
    {
      key: "description",
      header: "Description",
      role: "subtitle",
      render: (r) => r.place.description,
    },
    {
      key: "location",
      header: "Location",
      role: "chip",
      render: (r) => {
        const loc = locationCellFor(r.place, byId);
        if (loc.kind === "pinned") {
          return <Chip size="small" label="Pinned" color="success" />;
        }
        if (loc.kind === "uses") {
          return (
            <Chip
              size="small"
              label={`Uses ${loc.fromName}`}
              variant="outlined"
            />
          );
        }
        if (loc.kind === "warning") {
          return <Chip size="small" label="Not pinned yet" color="warning" />;
        }
        return (
          <Typography variant="caption" color="text.secondary">
            No pin
          </Typography>
        );
      },
    },
    {
      key: "codes",
      header: "Codes",
      role: "line",
      label: "Codes",
      render: (r) =>
        r.place.codes.length === 0
          ? ""
          : r.place.codes.map((c) => c.tag).join(", "),
    },
    {
      key: "people",
      header: "People",
      role: "line",
      label: "People",
      align: "right",
      render: (r) => r.place.scans.people,
    },
  ];

  return (
    <>
      <PageHeader
        title="Places"
        actions={
          <>
            <Button
              variant="contained"
              onClick={() => setCreateOpen({ parentId: null })}
            >
              New place
            </Button>
            <Button variant="outlined" component={RouterLink} to="/places/map">
              Map
            </Button>
          </>
        }
      />

      {listQ.error ? <ErrorAlert error={listQ.error} /> : null}

      {rows.length === 0 && !listQ.isLoading ? (
        <Alert severity="info">No places yet. Start with a top-level place.</Alert>
      ) : (
        <ResponsiveTable<PlaceTreeRow>
          rows={visibleRows}
          columns={columns}
          rowKey={(r) => String(r.place.id)}
          rowTestId={(r) => `place-row-${r.place.id}`}
          rowSx={(r) => ({ pl: r.depth * 2 })}
          emptyText="No places yet."
          leading={(r) =>
            r.childCount > 0 ? (
              <IconButton
                size="small"
                onClick={() => toggle(r.place.id)}
                aria-label={
                  r.isCollapsed
                    ? `Expand ${r.place.name}`
                    : `Collapse ${r.place.name}`
                }
              >
                {r.isCollapsed ? (
                  <ChevronRightIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
            ) : (
              <Box sx={{ width: 34 }} />
            )
          }
          actions={(r) => (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <IconButton
                component={RouterLink}
                to={`/places/${r.place.id}`}
                size="small"
                aria-label={`Edit ${r.place.name}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Actions for ${r.place.name}`}
                onClick={(ev) =>
                  setMenuAnchor({ el: ev.currentTarget, row: r.place })
                }
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
          audit={(r) => ({
            entity: "place",
            entityId: r.place.id,
            name: r.place.name,
            audit: r.place.audit,
          })}
        />
      )}

      {menuAnchor ? (
        <Menu open anchorEl={menuAnchor.el} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setCreateOpen({ parentId: menuAnchor.row.id });
              setMenuAnchor(null);
            }}
          >
            New place inside
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMoveTarget(menuAnchor.row);
              setMenuAnchor(null);
            }}
          >
            Move…
          </MenuItem>
          {isAdmin ? (
            <MenuItem
              onClick={() => {
                setConfirmDelete(menuAnchor.row);
                setMenuAnchor(null);
              }}
            >
              Delete
            </MenuItem>
          ) : null}
        </Menu>
      ) : null}

      {createOpen ? (
        <PlaceDialog
          open
          title={
            createOpen.parentId == null
              ? "New place"
              : `New place inside ${byId.get(createOpen.parentId)?.name ?? ""}`
          }
          submitLabel="Create"
          places={rows}
          pages={pagesQ.data?.items ?? []}
          initial={{ parentId: createOpen.parentId }}
          onCancel={() => setCreateOpen(null)}
          onSubmit={(v) => createMut.mutate(v)}
          submitting={createMut.isPending}
          error={createMut.error}
        />
      ) : null}

      {moveTarget ? (
        <PlaceDialog
          open
          title={`Move ${moveTarget.name}`}
          submitLabel="Move"
          places={rows}
          pages={pagesQ.data?.items ?? []}
          initial={{
            parentId: moveTarget.parentId,
            name: moveTarget.name,
            description: moveTarget.description,
            opensPageId: moveTarget.opensPageId,
            forwardUrl: moveTarget.forwardUrl,
          }}
          excludeIds={descendantsOf(moveTarget.id, rows)}
          onCancel={() => setMoveTarget(null)}
          onSubmit={(v) =>
            moveMut.mutate({ id: moveTarget.id, parentId: v.parentId })
          }
          submitting={moveMut.isPending}
          error={moveMut.error}
        />
      ) : null}

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="places"
          id={confirmDelete.id}
          name={confirmDelete.name}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(confirmDelete.id)}
        />
      ) : null}
    </>
  );
}

function descendantsOf(id: number, places: Place[]): Set<number> {
  const out = new Set<number>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of places) {
      if (p.parentId != null && out.has(p.parentId) && !out.has(p.id)) {
        out.add(p.id);
        grew = true;
      }
    }
  }
  return out;
}
