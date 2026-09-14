import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import { beacons as beaconsApi } from "../../api/resources/beacons";
import type { PatchEventBody } from "../../api/resources/events";
import { keys } from "../../queries/keys";
import type { StatusId } from "../../api/types";
import StatusChip from "../../components/StatusChip";
import ConfirmDialog from "../../components/ConfirmDialog";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { STATUS_IDS, statusName } from "../../lib/statusNames";
import { useNotify } from "../../hooks/useNotify";
import { useNow } from "../../hooks/useNow";
import {
  ageS,
  formatAgeS,
  fromLocalInputValue,
  formatMt,
  toLocalInputValue,
} from "../../lib/time";
import MessagesSection from "./MessagesSection";
import RouteSection from "./RouteSection";
import RoutePosterSection from "./RoutePosterSection";
import LocationsSection from "./LocationsSection";
import StatusDialog from "./StatusDialog";
import NotifyDialog from "./NotifyDialog";

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const notify = useNotify();
  const navigate = useNavigate();
  const now = useNow();

  const eventQ = useQuery({
    queryKey: keys.event(id),
    queryFn: () => eventsApi.get(id),
    enabled: Number.isFinite(id),
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });
  const historyQ = useQuery({
    queryKey: keys.eventHistory(id),
    queryFn: () => eventsApi.statusHistory(id),
    enabled: Number.isFinite(id),
  });
  const beaconsQ = useQuery({
    queryKey: keys.beacons,
    queryFn: () => beaconsApi.list(),
  });

  const patchMut = useMutation({
    mutationFn: (b: PatchEventBody) => eventsApi.patch(id, b),
    onSuccess: () => {
      notify("Event saved");
      void qc.invalidateQueries({ queryKey: keys.event(id) });
      void qc.invalidateQueries({ queryKey: keys.events });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({
      statusId,
      doNotify,
      message,
    }: {
      statusId: StatusId;
      doNotify: boolean;
      message: string | null;
    }) => eventsApi.setStatus(id, { statusId, notify: doNotify, message }),
    onSuccess: () => {
      notify("Status changed");
      void qc.invalidateQueries({ queryKey: keys.event(id) });
      void qc.invalidateQueries({ queryKey: keys.eventHistory(id) });
      void qc.invalidateQueries({ queryKey: keys.events });
    },
    onError: (e) => {
      notify(e instanceof Error ? e.message : "Status change failed", "error");
      void qc.invalidateQueries({ queryKey: keys.beacons });
    },
  });

  const notifyMut = useMutation({
    mutationFn: (message: string | null) => eventsApi.notify(id, { message }),
    onSuccess: () => {
      notify("Subscribers notified");
      void qc.invalidateQueries({ queryKey: keys.event(id) });
      void qc.invalidateQueries({ queryKey: keys.eventHistory(id) });
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Notify failed", "error"),
  });

  const setCurrentMut = useMutation({
    mutationFn: () => eventsApi.setCurrent(id),
    onSuccess: () => {
      notify("Current event set");
      void qc.invalidateQueries({ queryKey: keys.events });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => eventsApi.remove(id),
    onSuccess: () => {
      notify("Event deleted");
      void qc.invalidateQueries({ queryKey: keys.events });
      navigate("/events");
    },
  });

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<StatusId | null>(null);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCurrent, setConfirmCurrent] = useState(false);

  const event = eventQ.data ?? null;
  const eventsList = eventsQ.data?.items ?? [];
  const activeBeacon = beaconsQ.data?.items.find((b) => b.isActive) ?? null;

  const [form, setForm] = useState<{
    name: string;
    year: string;
    scheduledAt: string;
    wentLiveAt: string;
    endedAt: string;
    fundsPercent: string;
  }>({
    name: "",
    year: "",
    scheduledAt: "",
    wentLiveAt: "",
    endedAt: "",
    fundsPercent: "0",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (event) {
      setForm({
        name: event.name ?? "",
        year: String(event.year ?? ""),
        scheduledAt: toLocalInputValue(event.scheduledAt),
        wentLiveAt: toLocalInputValue(event.wentLiveAt),
        endedAt: toLocalInputValue(event.endedAt),
        fundsPercent: String(event.fundsPercent ?? "0"),
      });
    }
  }, [event]);

  const dirtyChanges = useMemo(() => {
    if (!event) return null;
    const changes: PatchEventBody = {};
    const trimmedName = form.name.trim();
    if (trimmedName !== event.name) changes.name = trimmedName;
    const y = Number(form.year);
    if (y !== Number(event.year)) changes.year = y;
    const scheduledIso = fromLocalInputValue(form.scheduledAt);
    if (scheduledIso !== (event.scheduledAt ?? null))
      changes.scheduledAt = scheduledIso;
    const wentLiveIso = fromLocalInputValue(form.wentLiveAt);
    if (wentLiveIso !== (event.wentLiveAt ?? null))
      changes.wentLiveAt = wentLiveIso;
    const endedIso = fromLocalInputValue(form.endedAt);
    if (endedIso !== (event.endedAt ?? null))
      changes.endedAt = endedIso;
    const fp = Number(form.fundsPercent);
    if (fp !== Number(event.fundsPercent)) changes.fundsPercent = fp;
    return Object.keys(changes).length === 0 ? null : changes;
  }, [event, form]);

  const save = () => {
    if (!event || !dirtyChanges) return;
    const next: Record<string, string> = {};
    if (dirtyChanges.name !== undefined && (dirtyChanges.name?.length ?? 0) < 1)
      next.name = "Name is required";
    if (dirtyChanges.year !== undefined) {
      const y = dirtyChanges.year;
      if (!Number.isInteger(y) || y < 2000 || y > 2100)
        next.year = "Year must be between 2000 and 2100";
    }
    if (dirtyChanges.fundsPercent !== undefined) {
      const fp = dirtyChanges.fundsPercent;
      if (!Number.isInteger(fp) || fp < 0 || fp > 100)
        next.fundsPercent = "Must be a whole number between 0 and 100";
    }
    if (
      dirtyChanges.scheduledAt !== undefined &&
      dirtyChanges.scheduledAt === null &&
      Number(event.statusId) === 2
    ) {
      next.scheduledAt = "Required while the event is scheduled";
    }
    setFormErrors(next);
    if (Object.keys(next).length > 0) return;
    patchMut.mutate(dirtyChanges);
  };

  if (eventQ.isLoading) {
    return <Typography>Loading…</Typography>;
  }
  if (eventQ.error || !event) {
    return <ErrorAlert error={eventQ.error ?? new Error("Event not found")} />;
  }

  const currentStatusId = Number(event.statusId) as StatusId;
  const anotherEventLive = eventsList.some(
    (e) => Number(e.statusId) === 3 && Number(e.id) !== Number(event.id)
  );
  const liveEventName = eventsList.find(
    (e) => Number(e.statusId) === 3 && Number(e.id) !== Number(event.id)
  )?.name;

  const healthyReason = (): string | null => {
    // Return null when the panel can confirm a healthy, active beacon;
    // otherwise return the reason for the tooltip and gate.
    const beaconItems = beaconsQ.data?.items ?? [];
    const active = beaconItems.find((b) => b.isActive === true) ?? null;
    if (active === null) return "none is active";
    if (active.revokedAt !== null && active.revokedAt !== undefined) {
      return `${active.name ?? "the active beacon"} is revoked`;
    }
    if (active.staleSince !== null && active.staleSince !== undefined) {
      return `${active.name ?? "the active beacon"} is stale since ${formatMt(active.staleSince)}`;
    }
    if (active.lastHeartbeatAt === null || active.lastHeartbeatAt === undefined) {
      return `${active.name ?? "the active beacon"} has never been heard from`;
    }
    if (active.healthy !== true) {
      return `${active.name ?? "the active beacon"} is not healthy`;
    }
    return null;
  };

  const disabledReason = (target: StatusId): string | null => {
    if (target === 2 && !event.scheduledAt) return "Set a scheduled time first";
    if (target === 3 && !event.isCurrent) return "Set this event current first";
    if (target === 3 && anotherEventLive)
      return `${liveEventName ?? "Another event"} is live`;
    if (target === 3) {
      const reason = healthyReason();
      if (reason !== null) return `No healthy active beacon: ${reason}`;
    }
    return null;
  };

  const openStatus = (target: StatusId) => {
    setStatusTarget(target);
    setStatusDialogOpen(true);
  };

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {event.name}
        </Typography>
        <StatusChip statusId={currentStatusId} />
        {event.isCurrent ? (
          <Alert severity="info" sx={{ py: 0 }}>
            Current event
          </Alert>
        ) : null}
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              {patchMut.error ? (
                <ErrorAlert
                  error={patchMut.error}
                  handledFields={Object.keys(formErrors)}
                />
              ) : null}
              <Stack spacing={2}>
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  error={!!formErrors.name}
                  helperText={formErrors.name ?? ""}
                  fullWidth
                />
                <TextField
                  label="Year"
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  error={!!formErrors.year}
                  helperText={formErrors.year ?? ""}
                  fullWidth
                />
                <ScheduledField
                  value={form.scheduledAt}
                  onChange={(v) => setForm({ ...form, scheduledAt: v })}
                  error={formErrors.scheduledAt}
                  disabledClear={currentStatusId === 2}
                />
                <TextField
                  label="Went live at"
                  type="datetime-local"
                  value={form.wentLiveAt}
                  onChange={(e) =>
                    setForm({ ...form, wentLiveAt: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                  helperText={
                    form.wentLiveAt
                      ? formatMt(fromLocalInputValue(form.wentLiveAt))
                      : ""
                  }
                  fullWidth
                />
                <TextField
                  label="Ended at"
                  type="datetime-local"
                  value={form.endedAt}
                  onChange={(e) => setForm({ ...form, endedAt: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  helperText={
                    form.endedAt
                      ? formatMt(fromLocalInputValue(form.endedAt))
                      : ""
                  }
                  fullWidth
                />
                <TextField
                  label="Funds percent"
                  type="number"
                  value={form.fundsPercent}
                  onChange={(e) =>
                    setForm({ ...form, fundsPercent: e.target.value })
                  }
                  error={!!formErrors.fundsPercent}
                  helperText={formErrors.fundsPercent ?? ""}
                  fullWidth
                />
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    onClick={save}
                    disabled={patchMut.isPending || !dirtyChanges}
                  >
                    Save
                  </Button>
                  {!event.isCurrent ? (
                    <Button onClick={() => setConfirmCurrent(true)}>
                      Set current
                    </Button>
                  ) : null}
                  <Box sx={{ flexGrow: 1 }} />
                  {(() => {
                    const blockReason =
                      Number(event.statusId) === 3
                        ? "This event is live. End it first."
                        : event.isCurrent
                          ? "This is the current event. Make another event current first."
                          : null;
                    const btn = (
                      <Button
                        color="error"
                        variant="outlined"
                        onClick={() => setConfirmDelete(true)}
                        disabled={blockReason !== null}
                      >
                        Delete
                      </Button>
                    );
                    return blockReason ? (
                      <Tooltip title={blockReason}>
                        <span>{btn}</span>
                      </Tooltip>
                    ) : (
                      btn
                    );
                  })()}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status
              </Typography>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <StatusChip statusId={currentStatusId} />
                <Box component="span" sx={{ color: "text.secondary" }}>
                  current
                </Box>
              </Stack>
              {event.statusNotifiedAt ? (
                <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
                  Subscribers were notified{" "}
                  {formatAgeS(ageS(event.statusNotifiedAt, now)) || "just now"}{" "}
                  ago
                </Typography>
              ) : (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ mb: 2 }}
                >
                  <Typography variant="body2" color="warning.main">
                    Nobody was notified of {statusName(currentStatusId)}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      notifyMut.reset();
                      setNotifyDialogOpen(true);
                    }}
                  >
                    Notify subscribers
                  </Button>
                </Stack>
              )}
              {statusMut.error ? (
                <ErrorAlert error={statusMut.error} />
              ) : null}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {STATUS_IDS.filter((s) => s !== currentStatusId).map(
                  (target) => {
                    const reason = disabledReason(target);
                    const btn = (
                      <span key={`w-${target}`}>
                        <Button
                          key={target}
                          variant="outlined"
                          size="small"
                          disabled={reason !== null}
                          onClick={() => openStatus(target)}
                        >
                          {statusName(target)}
                        </Button>
                      </span>
                    );
                    return reason ? (
                      <Tooltip key={target} title={reason}>
                        {btn}
                      </Tooltip>
                    ) : (
                      btn
                    );
                  }
                )}
              </Stack>
              <Typography variant="subtitle2" sx={{ mt: 3 }}>
                History
              </Typography>
              {historyQ.data?.items && historyQ.data.items.length > 0 ? (
                <Table size="small" data-testid="status-history">
                  <TableHead>
                    <TableRow>
                      <TableCell>Change</TableCell>
                      <TableCell>Who</TableCell>
                      <TableCell>When</TableCell>
                      <TableCell>Notified</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...historyQ.data.items]
                      .sort((a, b) =>
                        (a.changedAt ?? "") < (b.changedAt ?? "") ? 1 : -1
                      )
                      .map((h) => {
                        const from = Number(h.fromStatusId);
                        const to = Number(h.toStatusId);
                        const same = from === to;
                        const notified = h.notify === true;
                        const excerpt =
                          h.message && h.message.length > 0
                            ? h.message.slice(0, 60)
                            : null;
                        return (
                          <TableRow key={String(h.id)}>
                            <TableCell>
                              {same
                                ? "announced again"
                                : `${statusName(from)} → ${statusName(to)}`}
                            </TableCell>
                            <TableCell>{h.changedBy}</TableCell>
                            <TableCell>{formatMt(h.changedAt)}</TableCell>
                            <TableCell>
                              {notified ? (
                                <>
                                  <Typography variant="body2">
                                    Yes · {String(h.sentCount ?? 0)} sent
                                  </Typography>
                                  {excerpt ? (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {excerpt}
                                    </Typography>
                                  ) : null}
                                </>
                              ) : (
                                "No"
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No history yet.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <MessagesSection eventId={id} />
        </Grid>
        <Grid size={12}>
          <RoutePosterSection event={event} />
        </Grid>
        <Grid size={12}>
          <RouteSection event={event} />
        </Grid>
        <Grid size={12}>
          <LocationsSection event={event} />
        </Grid>
      </Grid>

      {statusTarget !== null ? (
        <StatusDialog
          open={statusDialogOpen}
          event={event}
          target={statusTarget}
          eventsList={eventsList}
          activeBeacon={activeBeacon}
          healthyReason={statusTarget === 3 ? healthyReason() : null}
          now={now}
          confirming={statusMut.isPending}
          error={statusMut.error}
          onCancel={() => {
            statusMut.reset();
            setStatusDialogOpen(false);
          }}
          onConfirm={({ notify: doNotify, message }) => {
            statusMut.mutate(
              { statusId: statusTarget, doNotify, message },
              {
                onSuccess: () => {
                  statusMut.reset();
                  setStatusDialogOpen(false);
                },
              }
            );
          }}
        />
      ) : null}

      <NotifyDialog
        open={notifyDialogOpen}
        event={event}
        confirming={notifyMut.isPending}
        error={notifyMut.error}
        onCancel={() => {
          notifyMut.reset();
          setNotifyDialogOpen(false);
        }}
        onConfirm={(message) => {
          notifyMut.mutate(message, {
            onSuccess: () => {
              notifyMut.reset();
              setNotifyDialogOpen(false);
            },
          });
        }}
      />

      <ConfirmDialog
        open={confirmCurrent}
        title="Set current event?"
        body={`Make ${event.name} the current event? The public site switches to it on its next poll.`}
        confirmLabel="Set current"
        disabled={setCurrentMut.isPending}
        onCancel={() => setConfirmCurrent(false)}
        onConfirm={() => {
          setCurrentMut.mutate();
          setConfirmCurrent(false);
        }}
      />

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="events"
          id={Number(event.id)}
          name={event.name ?? "event"}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteMut.mutate()}
        />
      ) : null}
    </>
  );
}

function ScheduledField({
  value,
  onChange,
  error,
  disabledClear,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabledClear: boolean;
}) {
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <TextField
        label="Scheduled at"
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        error={!!error}
        helperText={
          error ??
          (value ? formatMt(fromLocalInputValue(value)) : "")
        }
        fullWidth
      />
      <Tooltip
        title={
          disabledClear
            ? "Required while the event is scheduled"
            : ""
        }
      >
        <span>
          <Button onClick={() => onChange("")} disabled={disabledClear}>
            Clear
          </Button>
        </span>
      </Tooltip>
    </Stack>
  );
}
