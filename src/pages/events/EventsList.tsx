import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Tooltip from "@mui/material/Tooltip";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import type { CreateEventBody, CloneEventBody } from "../../api/resources/events";
import { routes as routesApi } from "../../api/resources/routes";
import { keys } from "../../queries/keys";
import StatusChip from "../../components/StatusChip";
import ConfirmDialog from "../../components/ConfirmDialog";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { formatMt } from "../../lib/time";
import { useNotify } from "../../hooks/useNotify";
import PageHeader from "../../components/layout/PageHeader";
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

  const routeLabelFor = (e: Event): string => {
    const rid = e.routeId === null ? null : Number(e.routeId);
    if (rid === null) return "none";
    return routesById.get(rid) ?? `#${rid}`;
  };

  const columns: Column<Event>[] = [
    {
      key: "year",
      header: "Year",
      role: "subtitle",
      render: (e) => String(e.year),
    },
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (e) => <RouterLink to={`/events/${e.id}`}>{e.name}</RouterLink>,
    },
    {
      key: "status",
      header: "Status",
      role: "chip",
      render: (e) => <StatusChip statusId={Number(e.statusId)} />,
    },
    {
      key: "current",
      header: "Current",
      role: "chip",
      render: (e) =>
        e.isCurrent ? (
          <Chip size="small" color="primary" label="Current" />
        ) : (
          <Box component="span" sx={{ color: "text.secondary" }}>
            none
          </Box>
        ),
      renderCompact: (e) =>
        e.isCurrent ? (
          <Chip size="small" color="primary" label="Current" />
        ) : null,
    },
    {
      key: "scheduledAt",
      header: "Scheduled at",
      role: "line",
      render: (e) => formatMt(e.scheduledAt) || "none",
    },
    {
      key: "route",
      header: "Route",
      role: "line",
      render: (e) => routeLabelFor(e),
    },
    {
      key: "fundsPercent",
      header: "Funds %",
      align: "right",
      role: "line",
      render: (e) => String(e.fundsPercent),
    },
  ];

  return (
    <>
      <PageHeader
        title="Events"
        actions={
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            New event
          </Button>
        }
      />

      {eventsQ.error ? (
        <ErrorAlert error={eventsQ.error} />
      ) : (
        <ResponsiveTable<Event>
          rows={events}
          columns={columns}
          rowKey={(e) => String(e.id)}
          rowTestId={(e) => `event-row-${e.id}`}
          emptyText="No events yet."
          actions={(e) => (
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
          )}
          audit={(e) => ({
            entity: "event",
            entityId: e.id ?? "",
            name: e.name ?? "event",
            audit: e.audit,
          })}
        />
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
          {(() => {
            const evt = menuAnchor.event;
            const blockReason =
              Number(evt.statusId) === 3
                ? "This event is live. End it first."
                : evt.isCurrent
                  ? "This is the current event. Make another event current first."
                  : null;
            const item = (
              <MenuItem
                disabled={blockReason !== null}
                onClick={() => {
                  setConfirmDelete(menuAnchor.event);
                  setMenuAnchor(null);
                }}
              >
                Delete
              </MenuItem>
            );
            return blockReason ? (
              <Tooltip title={blockReason} placement="left">
                <span>{item}</span>
              </Tooltip>
            ) : (
              item
            );
          })()}
        </Menu>
      ) : null}

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="events"
          id={Number(confirmDelete.id)}
          name={confirmDelete.name ?? "event"}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(Number(confirmDelete.id))}
        />
      ) : null}

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
