import { useState } from "react";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { posters as postersApi } from "../../api/resources/posters";
import { routes as routesApi } from "../../api/resources/routes";
import type { PosterSummary } from "../../api/types";
import AppDialog from "../../components/AppDialog";
import CommentBox from "../../components/CommentBox";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, { type Column } from "../../components/list/ResponsiveTable";
import { useNotify } from "../../hooks/useNotify";
import { formatStamp } from "../../lib/time";
import { keys } from "../../queries/keys";
import { copyName } from "./copyName";

// The poster list, /posters (admin.md 6.3, Poster studio): every poster
// newest first with its name, its flight recording, and when it was last
// saved. Create poster asks a name and opens the editor on the new
// poster; the row menu opens, duplicates (the whole poster under
// "<name> copy"), or deletes through the impact preview.
export default function PostersList() {
  const qc = useQueryClient();
  const notify = useNotify();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PosterSummary | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; poster: PosterSummary } | null>(
    null,
  );

  const postersQ = useQuery({ queryKey: keys.posters, queryFn: () => postersApi.list() });
  const routesQ = useQuery({ queryKey: keys.routes, queryFn: () => routesApi.list() });

  const createMut = useMutation({
    mutationFn: (name: string) => postersApi.create({ name }),
    onSuccess: (poster) => {
      void qc.invalidateQueries({ queryKey: keys.posters, exact: true });
      setCreateOpen(false);
      navigate(`/posters/${poster.id}`);
    },
  });

  const duplicateMut = useMutation({
    mutationFn: async (summary: PosterSummary) => {
      const source = await postersApi.get(Number(summary.id));
      return postersApi.create({
        name: copyName(source.name ?? summary.name ?? ""),
        routeId: source.routeId === null || source.routeId === undefined ? null : Number(source.routeId),
        layout: (source.layout as object | null | undefined) ?? null,
      });
    },
    onSuccess: () => {
      notify("Poster duplicated");
      void qc.invalidateQueries({ queryKey: keys.posters, exact: true });
    },
    onError: (e) => notify(e instanceof Error ? e.message : "Duplicate failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => postersApi.remove(id),
    onSuccess: (_, id) => {
      notify("Poster deleted");
      qc.removeQueries({ queryKey: keys.poster(id) });
      void qc.invalidateQueries({ queryKey: keys.posters, exact: true });
      setConfirmDelete(null);
    },
    onError: (e) => notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const posters = postersQ.data?.items ?? [];
  const recordings = routesQ.data?.items ?? [];

  const recordingLabel = (p: PosterSummary): string => {
    if (p.routeId === null || p.routeId === undefined) return "No recording";
    const found = recordings.find((r) => Number(r.id) === Number(p.routeId));
    return found?.name ?? `#${p.routeId}`;
  };

  const columns: Column<PosterSummary>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (p) => (
        <Link component={RouterLink} to={`/posters/${p.id}`}>
          {p.name}
        </Link>
      ),
    },
    {
      key: "recording",
      header: "Flight recording",
      role: "line",
      render: (p) => recordingLabel(p),
    },
    {
      key: "updated",
      header: "Updated",
      role: "line",
      render: (p) => formatStamp(p.updatedAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Poster studio"
        help="posters"
        actions={
          <Button variant="contained" onClick={() => setCreateOpen(true)} data-testid="poster-create">
            Create poster
          </Button>
        }
      />
      <CommentBox>
        Posters of a flight recording's route map with images, the logo, and QR codes over it.
        Generate saves the image in the media library, where an event can choose it as its
        route poster.
      </CommentBox>

      {postersQ.error ? (
        <ErrorAlert error={postersQ.error} />
      ) : (
        <ResponsiveTable<PosterSummary>
          rows={posters}
          columns={columns}
          rowKey={(p) => String(p.id)}
          rowTestId={(p) => `poster-row-${p.id}`}
          emptyText="No posters yet."
          actions={(p) => (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <IconButton
                size="small"
                component={RouterLink}
                to={`/posters/${p.id}`}
                aria-label={`Edit ${p.name ?? "poster"}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Actions for ${p.name ?? "poster"}`}
                onClick={(ev) => setMenuAnchor({ el: ev.currentTarget, poster: p })}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
          audit={(p) => ({
            entity: "poster",
            entityId: p.id ?? "",
            name: p.name ?? "poster",
            audit: null,
          })}
        />
      )}

      {menuAnchor ? (
        <Menu open anchorEl={menuAnchor.el} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              navigate(`/posters/${menuAnchor.poster.id}`);
              setMenuAnchor(null);
            }}
          >
            Open
          </MenuItem>
          <MenuItem
            disabled={duplicateMut.isPending}
            onClick={() => {
              duplicateMut.mutate(menuAnchor.poster);
              setMenuAnchor(null);
            }}
          >
            Duplicate
          </MenuItem>
          <MenuItem
            onClick={() => {
              setConfirmDelete(menuAnchor.poster);
              setMenuAnchor(null);
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      ) : null}

      <CreatePosterDialog
        open={createOpen}
        submitting={createMut.isPending}
        error={createMut.error}
        onCancel={() => {
          setCreateOpen(false);
          createMut.reset();
        }}
        onSubmit={(name) => createMut.mutate(name)}
      />

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="posters"
          id={Number(confirmDelete.id)}
          name={confirmDelete.name ?? "poster"}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(Number(confirmDelete.id))}
        />
      ) : null}
    </>
  );
}

interface CreateProps {
  open: boolean;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

function CreatePosterDialog({ open, submitting, error, onCancel, onSubmit }: CreateProps) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const close = () => {
    setName("");
    onCancel();
  };
  return (
    <AppDialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Create poster</DialogTitle>
      <DialogContent>
        {error ? <ErrorAlert error={error} /> : null}
        <TextField
          autoFocus
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmed && !submitting) onSubmit(trimmed);
          }}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          fullWidth
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!trimmed || submitting}
          onClick={() => onSubmit(trimmed)}
        >
          Create
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
