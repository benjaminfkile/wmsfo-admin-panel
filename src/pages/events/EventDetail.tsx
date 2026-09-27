import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
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
import type { StatusHistory, StatusId } from "../../api/types";
import StatusChip from "../../components/StatusChip";
import ConfirmDialog from "../../components/ConfirmDialog";
import DeleteDialog from "../../components/DeleteDialog";
import PageHeader from "../../components/layout/PageHeader";
import ErrorAlert from "../../components/ErrorAlert";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { STATUS_IDS, statusName } from "../../lib/statusNames";
import { useNotify } from "../../hooks/useNotify";
import { useNow } from "../../hooks/useNow";
import {
  ageS,
  browserTimeZone,
  formatAgeS,
  formatStamp,
  shiftWallZone,
  utcToWallTime,
  wallTimeToUtc,
} from "../../lib/time";
import TimeZoneSelect from "../../components/TimeZoneSelect";
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
    timeZone: string;
    fundsPercent: string;
  }>({
    name: "",
    year: "",
    scheduledAt: "",
    wentLiveAt: "",
    endedAt: "",
    timeZone: browserTimeZone(),
    fundsPercent: "0",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (event) {
      const zone = event.scheduleTimeZone || browserTimeZone();
      setForm({
        name: event.name ?? "",
        year: String(event.year ?? ""),
        scheduledAt: utcToWallTime(event.scheduledAt, zone),
        wentLiveAt: utcToWallTime(event.wentLiveAt, zone),
        endedAt: utcToWallTime(event.endedAt, zone),
        timeZone: zone,
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
    // The datetime fields are wall times in the picked zone. A field is
    // sent when its wall time or the zone changed and the instant it
    // reads as differs from the stored one.
    const initialZone = event.scheduleTimeZone || browserTimeZone();
    const zoneChanged = form.timeZone !== initialZone;
    // The inputs hold minutes, so a stored instant is compared at minute
    // precision: an untouched field never patches just because a zone
    // switch round-tripped it through its wall time.
    const minuteIso = (v: string | null | undefined) => {
      if (!v) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return null;
      d.setUTCSeconds(0, 0);
      return d.toISOString();
    };
    const instant = (wall: string, stored: string | null | undefined) => {
      const edited =
        zoneChanged || wall !== utcToWallTime(stored, initialZone);
      const iso = wallTimeToUtc(wall, form.timeZone);
      return edited && iso !== minuteIso(stored) ? iso : undefined;
    };
    const scheduledIso = instant(form.scheduledAt, event.scheduledAt);
    if (scheduledIso !== undefined) changes.scheduledAt = scheduledIso;
    const wentLiveIso = instant(form.wentLiveAt, event.wentLiveAt);
    if (wentLiveIso !== undefined) changes.wentLiveAt = wentLiveIso;
    const endedIso = instant(form.endedAt, event.endedAt);
    if (endedIso !== undefined) changes.endedAt = endedIso;
    const timesChanged =
      scheduledIso !== undefined ||
      wentLiveIso !== undefined ||
      endedIso !== undefined;
    if (
      (zoneChanged || timesChanged) &&
      form.timeZone !== (event.scheduleTimeZone ?? null)
    )
      changes.scheduleTimeZone = form.timeZone;
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
      return `${active.name ?? "the active beacon"} is stale since ${formatStamp(active.staleSince)}`;
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
      <PageHeader
        title={event.name ?? "Event"}
        chips={
          <>
            <StatusChip statusId={currentStatusId} />
            {event.isCurrent ? (
              <Chip size="small" color="info" label="Current event" />
            ) : null}
          </>
        }
      />

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
                <TimeZoneSelect
                  value={form.timeZone}
                  onChange={(z) =>
                    // Keep the instants: the wall texts re-render in the new
                    // zone instead of silently meaning a different moment.
                    setForm({
                      ...form,
                      timeZone: z,
                      scheduledAt: shiftWallZone(form.scheduledAt, form.timeZone, z),
                      wentLiveAt: shiftWallZone(form.wentLiveAt, form.timeZone, z),
                      endedAt: shiftWallZone(form.endedAt, form.timeZone, z),
                    })
                  }
                  helperText="The times below are in this zone"
                />
                <ClearableDateTimeField
                  label="Scheduled at"
                  value={form.scheduledAt}
                  timeZone={form.timeZone}
                  onChange={(v) => setForm({ ...form, scheduledAt: v })}
                  error={formErrors.scheduledAt}
                  clearDisabledReason={
                    currentStatusId === 2
                      ? "Required while the event is scheduled"
                      : null
                  }
                />
                <ClearableDateTimeField
                  label="Went live at"
                  value={form.wentLiveAt}
                  timeZone={form.timeZone}
                  onChange={(v) => setForm({ ...form, wentLiveAt: v })}
                />
                <ClearableDateTimeField
                  label="Ended at"
                  value={form.endedAt}
                  timeZone={form.timeZone}
                  onChange={(v) => setForm({ ...form, endedAt: v })}
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
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  data-testid="event-details-actions"
                >
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
              <Box data-testid="status-history">
                <StatusHistorySection items={historyQ.data?.items ?? []} />
              </Box>
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

function StatusHistorySection({ items }: { items: StatusHistory[] }) {
  const sorted = [...items].sort((a, b) =>
    (a.changedAt ?? "") < (b.changedAt ?? "") ? 1 : -1
  );
  const columns: Column<StatusHistory>[] = [
    {
      key: "change",
      header: "Change",
      role: "title",
      render: (h) => {
        const from = Number(h.fromStatusId);
        const to = Number(h.toStatusId);
        return from === to
          ? "announced again"
          : `${statusName(from)} → ${statusName(to)}`;
      },
    },
    {
      key: "who",
      header: "Who",
      role: "line",
      label: "who",
      render: (h) => h.changedBy ?? "",
    },
    {
      key: "when",
      header: "When",
      role: "line",
      label: "when",
      render: (h) => formatStamp(h.changedAt),
    },
    {
      key: "notified",
      header: "Notified",
      role: "line",
      label: "notified",
      render: (h) => {
        const notified = h.notify === true;
        const excerpt =
          h.message && h.message.length > 0 ? h.message.slice(0, 60) : null;
        if (!notified) return "No";
        return (
          <>
            {`Yes · ${String(h.sentCount ?? 0)} sent`}
            {excerpt ? (
              <Box
                component="span"
                sx={{ ml: 1, color: "text.secondary", fontSize: "0.75rem" }}
              >
                {excerpt}
              </Box>
            ) : null}
          </>
        );
      },
    },
  ];
  return (
    <ResponsiveTable<StatusHistory>
      rows={sorted}
      columns={columns}
      rowKey={(h) => String(h.id)}
      emptyText="No history yet."
    />
  );
}

// A datetime-local input with a Clear button beside it; every one of the
// event's three times can be cleared, saving them as null.
function ClearableDateTimeField({
  label,
  value,
  timeZone,
  onChange,
  error,
  clearDisabledReason = null,
}: {
  label: string;
  value: string;
  timeZone: string;
  onChange: (v: string) => void;
  error?: string;
  clearDisabledReason?: string | null;
}) {
  const disabledClear = clearDisabledReason !== null;
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <TextField
        label={label}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        error={!!error}
        helperText={
          error ??
          (value ? formatStamp(wallTimeToUtc(value, timeZone)) : "")
        }
        fullWidth
      />
      <Tooltip title={clearDisabledReason ?? ""}>
        <span>
          <Button onClick={() => onChange("")} disabled={disabledClear}>
            Clear
          </Button>
        </span>
      </Tooltip>
    </Stack>
  );
}
