import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import { routes as routesApi } from "../../api/resources/routes";
import type { RouteUploadBody } from "../../api/resources/routes";
import { keys } from "../../queries/keys";
import { ApiError } from "../../api/errors";
import CommentBox from "../../components/CommentBox";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { formatMt } from "../../lib/time";
import { useNotify } from "../../hooks/useNotify";
import RouteUploadDialog from "../events/RouteUploadDialog";
import type { Event, Route } from "../../api/types";

export default function RoutesList() {
  const qc = useQueryClient();
  const notify = useNotify();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fromEventOpen, setFromEventOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Route | null>(null);

  const routesQ = useQuery({
    queryKey: keys.routes,
    queryFn: () => routesApi.list(),
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const uploadMut = useMutation({
    mutationFn: (b: RouteUploadBody) => routesApi.create(b),
    onSuccess: () => {
      notify("Route uploaded");
      void qc.invalidateQueries({ queryKey: keys.routes });
      setUploadOpen(false);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Upload failed", "error"),
  });

  const fromEventMut = useMutation({
    mutationFn: ({ eventId, name }: { eventId: number; name: string }) =>
      routesApi.fromEvent(eventId, { name }),
    onSuccess: () => {
      notify("Route built from event");
      void qc.invalidateQueries({ queryKey: keys.routes });
      setFromEventOpen(false);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Build failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => routesApi.remove(id),
    onSuccess: () => {
      notify("Route deleted");
      void qc.invalidateQueries({ queryKey: keys.routes });
      setConfirmDelete(null);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "route_in_use") {
        const usedBy = usedByFor(confirmDelete, events);
        notify(
          usedBy.length > 0
            ? `Used by ${usedBy.join(", ")}; unlink it there first`
            : "Route in use; unlink it there first",
          "error"
        );
      } else {
        notify(e instanceof Error ? e.message : "Delete failed", "error");
      }
    },
  });

  const routes = [...(routesQ.data?.items ?? [])].sort((a, b) =>
    (a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1
  );
  const events = eventsQ.data?.items ?? [];

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">Flight recordings</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" onClick={() => setFromEventOpen(true)}>
            Build from event
          </Button>
          <Button variant="contained" onClick={() => setUploadOpen(true)}>
            Upload recording
          </Button>
        </Stack>
      </Stack>
      <CommentBox>
        Recordings of past flights. The one linked to an event is its flight
        history on the tracker, and what Red-Nose replay and exports use. The
        route page shows the poster on each event.
      </CommentBox>

      {routesQ.error ? (
        <ErrorAlert error={routesQ.error} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Uploaded by</TableCell>
                <TableCell>Link</TableCell>
                <TableCell>Used by</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {routes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">
                      No routes yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                routes.map((r) => {
                  const usedBy = events.filter(
                    (e) => e.routeId !== null && Number(e.routeId) === Number(r.id)
                  );
                  return (
                    <TableRow key={String(r.id)}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell align="right">{String(r.pointCount)}</TableCell>
                      <TableCell>{formatMt(r.createdAt)}</TableCell>
                      <TableCell>{r.uploadedBy}</TableCell>
                      <TableCell>
                        {r.url ? (
                          <Link
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            CDN
                          </Link>
                        ) : (
                          "none"
                        )}
                      </TableCell>
                      <TableCell>
                        {usedBy.length === 0
                          ? "none"
                          : usedBy.map((e) => e.name).join(", ")}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Delete"
                          onClick={() => setConfirmDelete(r)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <RouteUploadDialog
        open={uploadOpen}
        submitting={uploadMut.isPending}
        error={uploadMut.error}
        onCancel={() => setUploadOpen(false)}
        onSubmit={(b) => uploadMut.mutate(b)}
      />

      <BuildFromEventDialog
        open={fromEventOpen}
        events={events}
        submitting={fromEventMut.isPending}
        error={fromEventMut.error}
        onCancel={() => setFromEventOpen(false)}
        onSubmit={(eventId, name) => fromEventMut.mutate({ eventId, name })}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete route?"
        body={
          confirmDelete
            ? `Delete ${confirmDelete.name}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        disabled={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() =>
          confirmDelete && deleteMut.mutate(Number(confirmDelete.id))
        }
      />
    </>
  );
}

function usedByFor(route: Route | null, events: Event[]): string[] {
  if (!route) return [];
  return events
    .filter(
      (e) => e.routeId !== null && Number(e.routeId) === Number(route.id)
    )
    .map((e) => e.name ?? `#${e.id ?? "?"}`);
}

interface BuildProps {
  open: boolean;
  events: Event[];
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (eventId: number, name: string) => void;
}

function BuildFromEventDialog({
  open,
  events,
  submitting,
  error,
  onCancel,
  onSubmit,
}: BuildProps) {
  const [eventId, setEventId] = useState<number | "">("");
  const [name, setName] = useState("");
  const eligible = events.filter((e) => Number(e.statusId) === 4);
  const selected = eligible.find((e) => Number(e.id) === Number(eventId));

  return (
    <Dialog
      open={open}
      onClose={() => {
        onCancel();
        setEventId("");
        setName("");
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Build route from event</DialogTitle>
      <DialogContent>
        <Card variant="outlined" sx={{ mt: 1, mb: 2 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Build a route from an ended event's published locations. The new
              route is created with a fresh id and can be linked to any event
              from its page.
            </Typography>
          </CardContent>
        </Card>
        {error ? <ErrorAlert error={error} /> : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Select
            displayEmpty
            value={eventId === "" ? "" : String(eventId)}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Number(e.target.value);
              setEventId(v);
              const chosen = eligible.find((x) => Number(x.id) === v);
              if (chosen) setName(`${chosen.name} route`);
            }}
          >
            <MenuItem value="">
              <em>Select an ended event…</em>
            </MenuItem>
            {eligible.map((e) => (
              <MenuItem key={String(e.id)} value={String(e.id)}>
                {e.name} ({String(e.year)})
              </MenuItem>
            ))}
          </Select>
          {eligible.length === 0 ? (
            <Alert severity="info">
              No ended events available to build a route from.
            </Alert>
          ) : null}
          <TextField
            label="Route name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          {selected ? (
            <Typography variant="body2" color="text.secondary">
              Building from {selected.name}
              {selected.endedAt ? ` (ended ${formatMt(selected.endedAt)})` : ""}
            </Typography>
          ) : null}
          <Box />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onCancel();
            setEventId("");
            setName("");
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() =>
            eventId !== "" && onSubmit(Number(eventId), name.trim())
          }
          disabled={
            eventId === "" || submitting || name.trim().length < 1
          }
        >
          Build
        </Button>
      </DialogActions>
    </Dialog>
  );
}
