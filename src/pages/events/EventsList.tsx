import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
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
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import type { CreateEventBody, CloneEventBody } from "../../api/resources/events";
import { routes as routesApi } from "../../api/resources/routes";
import { keys } from "../../queries/keys";
import StatusChip from "../../components/StatusChip";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import AuditCell from "../../components/audit/AuditCell";
import { formatMt } from "../../lib/time";
import { useNotify } from "../../hooks/useNotify";
import EventCreateDialog from "./EventCreateDialog";
import EventCloneDialog from "./EventCloneDialog";
import type { Event } from "../../api/types";

export default function EventsList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const [createOpen, setCreateOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState<Event | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Event | null>(null);
  const [confirmCurrent, setConfirmCurrent] = useState<Event | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    event: Event;
  } | null>(null);

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

  const cloneMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CloneEventBody }) =>
      eventsApi.clone(id, body),
    onSuccess: (created) => {
      notify("Event cloned");
      void qc.invalidateQueries({ queryKey: keys.events });
      setCloneSource(null);
      navigate(`/events/${created.id}`);
    },
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
                <TableCell align="right">Audit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
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
                            none
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>{formatMt(e.scheduledAt) || "none"}</TableCell>
                      <TableCell>{routeLabel}</TableCell>
                      <TableCell align="right">
                        {String(e.fundsPercent)}
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          <IconButton
                            size="small"
                            component={RouterLink}
                            to={`/events/${e.id}`}
                            aria-label={`Edit ${e.name ?? "event"}`}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={`Actions for ${e.name ?? "event"}`}
                            onClick={(ev) =>
                              setMenuAnchor({ el: ev.currentTarget, event: e })
                            }
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                      <AuditCell
                        entity="event"
                        entityId={e.id ?? ""}
                        name={e.name ?? "event"}
                        audit={e.audit}
                        align="right"
                      />
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

      <EventCloneDialog
        open={cloneSource !== null}
        source={cloneSource}
        submitting={cloneMut.isPending}
        error={cloneMut.error}
        onCancel={() => {
          setCloneSource(null);
          cloneMut.reset();
        }}
        onSubmit={(b) => {
          if (cloneSource !== null)
            cloneMut.mutate({ id: Number(cloneSource.id), body: b });
        }}
      />

      {menuAnchor ? (
        <Menu
          open
          anchorEl={menuAnchor.el}
          onClose={() => setMenuAnchor(null)}
        >
          {!menuAnchor.event.isCurrent ? (
            <MenuItem
              onClick={() => {
                setConfirmCurrent(menuAnchor.event);
                setMenuAnchor(null);
              }}
            >
              Set current
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={() => {
              cloneMut.reset();
              setCloneSource(menuAnchor.event);
              setMenuAnchor(null);
            }}
          >
            Clone
          </MenuItem>
          <MenuItem
            onClick={() => {
              setConfirmDelete(menuAnchor.event);
              setMenuAnchor(null);
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      ) : null}

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
