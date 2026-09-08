import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import type { CreateEventBody } from "../../api/resources/events";
import { routes as routesApi } from "../../api/resources/routes";
import { keys } from "../../queries/keys";
import StatusChip from "../../components/StatusChip";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { formatMt } from "../../lib/time";
import { useNotify } from "../../hooks/useNotify";
import EventCreateDialog from "./EventCreateDialog";
import type { Event } from "../../api/types";

export default function EventsList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Event | null>(null);
  const [confirmCurrent, setConfirmCurrent] = useState<Event | null>(null);

  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });
  const routesQ = useQuery({
    queryKey: keys.routes,
    queryFn: () => routesApi.list(),
  });

  const createMut = useMutation({
    mutationFn: (b: CreateEventBody) => eventsApi.create(b),
    onSuccess: (created) => {
      notify("Event created");
      void qc.invalidateQueries({ queryKey: keys.events });
      setCreateOpen(false);
      navigate(`/events/${created.id}`);
    },
  });

  const setCurrentMut = useMutation({
    mutationFn: (id: number) => eventsApi.setCurrent(id),
    onSuccess: () => {
      notify("Current event set");
      void qc.invalidateQueries({ queryKey: keys.events });
      setConfirmCurrent(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Failed to set current", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => eventsApi.remove(id),
    onSuccess: () => {
      notify("Event deleted");
      void qc.invalidateQueries({ queryKey: keys.events });
      setConfirmDelete(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const events = eventsQ.data?.items ?? [];
  const routesById = new Map(
    (routesQ.data?.items ?? []).map((r) => [Number(r.id), r.name])
  );

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">Events</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New event
        </Button>
      </Stack>
      {eventsQ.error ? (
        <ErrorAlert error={eventsQ.error} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Year</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Current</TableCell>
                <TableCell>Scheduled at</TableCell>
                <TableCell>Route</TableCell>
                <TableCell align="right">Funds %</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary">
                      No events yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                events.map((e) => {
                  const rid = e.routeId === null ? null : Number(e.routeId);
                  const routeLabel =
                    rid === null
                      ? "none"
                      : routesById.get(rid) ?? `#${rid}`;
                  return (
                    <TableRow
                      key={String(e.id)}
                      hover
                      data-testid={`event-row-${e.id}`}
                    >
                      <TableCell>{String(e.year)}</TableCell>
                      <TableCell>
                        <RouterLink to={`/events/${e.id}`}>{e.name}</RouterLink>
                      </TableCell>
                      <TableCell>
                        <StatusChip statusId={Number(e.statusId)} />
                      </TableCell>
                      <TableCell>
                        {e.isCurrent ? (
                          <Chip size="small" color="primary" label="Current" />
                        ) : (
                          <Box component="span" sx={{ color: "text.secondary" }}>
                            —
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>{formatMt(e.scheduledAt) || "—"}</TableCell>
                      <TableCell>{routeLabel}</TableCell>
                      <TableCell align="right">
                        {String(e.fundsPercent)}
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Button
                            size="small"
                            component={RouterLink}
                            to={`/events/${e.id}`}
                          >
                            Open
                          </Button>
                          {!e.isCurrent ? (
                            <Button
                              size="small"
                              onClick={() => setConfirmCurrent(e)}
                              disabled={setCurrentMut.isPending}
                            >
                              Set current
                            </Button>
                          ) : null}
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Delete"
                            onClick={() => setConfirmDelete(e)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EventCreateDialog
        open={createOpen}
        events={events}
        routes={routesQ.data?.items ?? []}
        submitting={createMut.isPending}
        error={createMut.error}
        onCancel={() => {
          setCreateOpen(false);
          createMut.reset();
        }}
        onSubmit={(b) => createMut.mutate(b)}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete event?"
        body={
          confirmDelete
            ? `Delete ${confirmDelete.name}? Its messages, cookies, and status history are deleted with it.`
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

      <ConfirmDialog
        open={confirmCurrent !== null}
        title="Set current event?"
        body={
          confirmCurrent
            ? `Make ${confirmCurrent.name} the current event? The public site switches to it on its next poll.`
            : ""
        }
        confirmLabel="Set current"
        disabled={setCurrentMut.isPending}
        onCancel={() => setConfirmCurrent(null)}
        onConfirm={() =>
          confirmCurrent && setCurrentMut.mutate(Number(confirmCurrent.id))
        }
      />
    </>
  );
}
