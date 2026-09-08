import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../api/resources/events";
import { snapshot as snapshotApi } from "../api/resources/snapshot";
import { live as liveApi } from "../api/resources/live";
import { beacons as beaconsApi } from "../api/resources/beacons";
import { cookieTypes as cookieTypesApi } from "../api/resources/cookieTypes";
import { fetchLiveObject } from "../api/cdn";
import { CdnError } from "../api/errors";
import { keys } from "../queries/keys";
import { polled } from "../queries/polling";
import StatusChip from "../components/StatusChip";
import { ThemedJsonView } from "../components/ThemedJsonView";
import ErrorAlert from "../components/ErrorAlert";
import ConfirmDialog from "../components/ConfirmDialog";
import { useNotify } from "../hooks/useNotify";
import { useNow } from "../hooks/useNow";
import {
  ageS,
  formatAgeS,
  formatMt,
} from "../lib/time";
import type {
  Beacon,
  Event,
  LiveObject,
  LiveState,
  SnapshotInfo,
} from "../api/types";
import { resolvePublishedState } from "../lib/publishedState";
import StatusDialog from "./events/StatusDialog";

const DASHBOARD_KEYS = [
  keys.events,
  keys.live,
  keys.cdnLive,
  keys.snapshot,
  keys.beacons,
] as const;

export default function Dashboard() {
  const notify = useNotify();
  const qc = useQueryClient();
  const now = useNow();

  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });
  const liveQ = useQuery({
    queryKey: keys.live,
    queryFn: () => liveApi.get(),
    ...polled,
  });
  const cdnQ = useQuery<LiveObject, unknown>({
    queryKey: keys.cdnLive,
    queryFn: () => fetchLiveObject(),
    ...polled,
  });
  const snapshotQ = useQuery({
    queryKey: keys.snapshot,
    queryFn: () => snapshotApi.get(),
  });
  const beaconsQ = useQuery({
    queryKey: keys.beacons,
    queryFn: () => beaconsApi.list(),
    ...polled,
  });
  const cookieTypesQ = useQuery({
    queryKey: keys.cookieTypes,
    queryFn: () => cookieTypesApi.list(),
  });

  const invalidateAll = () => {
    for (const k of DASHBOARD_KEYS) {
      void qc.invalidateQueries({ queryKey: k });
    }
  };

  const rebuildSnapMut = useMutation({
    mutationFn: () => snapshotApi.rebuild(),
    onSuccess: () => {
      notify("Snapshot rebuilt");
      invalidateAll();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Snapshot rebuild failed", "error"),
  });

  const republishMut = useMutation({
    mutationFn: () => liveApi.republish(),
    onSuccess: () => {
      notify("Republished");
      invalidateAll();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Republish failed", "error"),
  });

  const setStatusMut = useMutation({
    mutationFn: ({
      id,
      statusId,
      notify: doNotify,
    }: {
      id: number;
      statusId: 1 | 2 | 3 | 4 | 5;
      notify: boolean;
    }) => eventsApi.setStatus(id, { statusId, notify: doNotify }),
    onSuccess: () => {
      notify("Status changed");
      invalidateAll();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Status change failed", "error"),
  });

  const eventsList = eventsQ.data?.items ?? [];
  const currentEvent = eventsList.find((e) => e.isCurrent) ?? null;
  const activeBeacon = beaconsQ.data?.items.find((b) => b.isActive) ?? null;
  const staleAfterS = beaconsQ.data?.staleAfterS ?? 45;
  const anyLive = eventsList.some((e) => e.statusId === 3);

  const previousMismatched = useRef(false);
  const cdnStatus =
    cdnQ.error instanceof CdnError ? cdnQ.error.status : cdnQ.error ? null : null;
  const resolvedPublished = useMemo(() => {
    return resolvePublishedState({
      cdn: cdnQ.data ?? null,
      cdnStatus,
      current: currentEvent,
      snapshot: snapshotQ.data ?? null,
      state: liveQ.data ?? null,
      previousMismatched: previousMismatched.current,
    });
  }, [cdnQ.data, cdnStatus, currentEvent, snapshotQ.data, liveQ.data]);
  previousMismatched.current = resolvedPublished.mismatchedNow;

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  const openStatus = (target: 1 | 2 | 3 | 4 | 5) => {
    setStatusTarget(target);
    setStatusDialogOpen(true);
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <CurrentEventCard
            event={currentEvent}
            error={eventsQ.error}
            loading={eventsQ.isLoading}
            onOpenStatus={openStatus}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ActiveBeaconCard
            beacon={activeBeacon}
            error={beaconsQ.error}
            loading={beaconsQ.isLoading}
            staleAfterS={staleAfterS}
            anyLive={anyLive}
            now={now}
          />
        </Grid>
        <Grid size={12}>
          <PublishedStateCard
            resolved={resolvedPublished.state}
            live={liveQ.data ?? null}
            now={now}
            onRepublish={() => republishMut.mutate()}
            republishing={republishMut.isPending}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SnapshotCard
            snap={snapshotQ.data ?? null}
            error={snapshotQ.error}
            onRebuild={() => rebuildSnapMut.mutate()}
            rebuilding={rebuildSnapMut.isPending}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <LiveObjectCard
            cdn={cdnQ.data ?? null}
            liveState={liveQ.data ?? null}
            cookieNames={
              cookieTypesQ.data
                ? Object.fromEntries(
                    (cookieTypesQ.data.items ?? []).map((c) => [
                      String(c.id),
                      c.name ?? "",
                    ])
                  )
                : {}
            }
            now={now}
          />
        </Grid>
      </Grid>

      {currentEvent && statusTarget ? (
        <StatusDialog
          open={statusDialogOpen}
          event={currentEvent}
          target={statusTarget}
          eventsList={eventsList}
          activeBeacon={activeBeacon}
          now={now}
          confirming={setStatusMut.isPending}
          onCancel={() => setStatusDialogOpen(false)}
          onConfirm={(notifyValue) => {
            setStatusMut.mutate(
              { id: Number(currentEvent.id), statusId: statusTarget, notify: notifyValue },
              { onSettled: () => setStatusDialogOpen(false) }
            );
          }}
        />
      ) : null}
    </>
  );
}

function LabeledLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Typography variant="body2" component="div">
      <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
        {label}:
      </Box>
      <Box component="span">{children}</Box>
    </Typography>
  );
}

function CurrentEventCard({
  event,
  error,
  loading,
  onOpenStatus,
}: {
  event: Event | null;
  error: unknown;
  loading: boolean;
  onOpenStatus: (id: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Current event
        </Typography>
        {error ? (
          <ErrorAlert error={error} />
        ) : loading ? (
          <Typography variant="body2">Loading…</Typography>
        ) : event === null ? (
          <>
            <Typography variant="body2" sx={{ mb: 1 }}>
              No current event
            </Typography>
            <Link component={RouterLink} to="/events">
              Go to Events
            </Link>
          </>
        ) : (
          <Stack spacing={1}>
            <Typography variant="subtitle1">
              {event.name}{" "}
              <Box component="span" sx={{ color: "text.secondary" }}>
                ({event.year})
              </Box>
            </Typography>
            <Box>
              <StatusChip statusId={Number(event.statusId)} />
            </Box>
            <LabeledLine label="scheduledAt">
              {formatMt(event.scheduledAt) || "—"}
            </LabeledLine>
            <LabeledLine label="wentLiveAt">
              {formatMt(event.wentLiveAt) || "—"}
            </LabeledLine>
            <LabeledLine label="endedAt">
              {formatMt(event.endedAt) || "—"}
            </LabeledLine>
            <LabeledLine label="fundsPercent">
              {String(event.fundsPercent)}%
            </LabeledLine>
            <LabeledLine label="route">
              {event.routeId === null ? "no route" : `#${event.routeId}`}
            </LabeledLine>
          </Stack>
        )}
      </CardContent>
      {event ? (
        <CardActions>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onOpenStatus(pickNextStatus(Number(event.statusId)))}
          >
            Change status
          </Button>
          <Button
            size="small"
            component={RouterLink}
            to={`/events/${event.id}`}
          >
            Open event
          </Button>
        </CardActions>
      ) : null}
    </Card>
  );
}

function pickNextStatus(current: number): 1 | 2 | 3 | 4 | 5 {
  const order: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];
  const other = order.find((s) => s !== current);
  return other ?? 1;
}

function ActiveBeaconCard({
  beacon,
  error,
  loading,
  staleAfterS,
  anyLive,
  now,
}: {
  beacon: Beacon | null;
  error: unknown;
  loading: boolean;
  staleAfterS: number;
  anyLive: boolean;
  now: number;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Active beacon
        </Typography>
        {error ? (
          <ErrorAlert error={error} />
        ) : loading ? (
          <Typography variant="body2">Loading…</Typography>
        ) : beacon === null ? (
          <Typography variant="body2" color={anyLive ? "error" : "text.secondary"}>
            No active beacon
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">
              {beacon.name}{" "}
              <Box component="span" sx={{ color: "text.secondary" }}>
                ({beacon.role})
              </Box>
            </Typography>
            <LabeledLine label="keyPrefix">
              <code>{beacon.keyPrefix}</code>
            </LabeledLine>
            <LabeledLine label="heartbeat">
              {formatAgeS(ageS(beacon.lastHeartbeatAt, now)) || "never"}
            </LabeledLine>
            <LabeledLine label="last location">
              {formatAgeS(ageS(beacon.lastLocationAt, now)) || "never"}
            </LabeledLine>
            <LabeledLine label="staleSince">
              {beacon.staleSince ? formatMt(beacon.staleSince) : "—"}
            </LabeledLine>
            <LabeledLine label="staleAfterS">{String(staleAfterS)} s</LabeledLine>
          </Stack>
        )}
      </CardContent>
      {beacon ? (
        <CardActions>
          <Button
            size="small"
            component={RouterLink}
            to={`/beacons/${beacon.id}`}
          >
            Open beacon
          </Button>
        </CardActions>
      ) : null}
    </Card>
  );
}

function PublishedStateCard({
  resolved,
  live,
  now,
  onRepublish,
  republishing,
}: {
  resolved: ReturnType<typeof resolvePublishedState>["state"];
  live: LiveState | null;
  now: number;
  onRepublish: () => void;
  republishing: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Published state
        </Typography>
        {resolved.kind === "ok" ? (
          <Alert severity="success">
            CDN current
            {live?.lastWriteAt
              ? `, written ${formatAgeS(ageS(live.lastWriteAt, now))} ago by ${
                  live.lastWriteNode ?? "?"
                }`
              : ""}
          </Alert>
        ) : resolved.kind === "behind" ? (
          <Alert severity="error">
            <Typography variant="body2" gutterBottom>
              CDN behind
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              {resolved.mismatches.map((m) => (
                <li key={m.field}>
                  <Typography variant="body2">
                    {m.field}: cdn={String(m.cdn)} api={String(m.api)}
                  </Typography>
                </li>
              ))}
            </Box>
          </Alert>
        ) : resolved.kind === "write_error" ? (
          <Alert severity="error">Write error: {resolved.error}</Alert>
        ) : resolved.kind === "cdn_unreachable" ? (
          <Alert severity="warning">
            CDN unreachable{resolved.status ? ` (HTTP ${resolved.status})` : ""}
          </Alert>
        ) : (
          <Typography variant="body2">Loading…</Typography>
        )}
        {live ? (
          <Stack spacing={0.5} sx={{ mt: 2 }}>
            <LabeledLine label="lastWriteAt">
              {formatMt(live.lastWriteAt) || "—"}
            </LabeledLine>
            <LabeledLine label="lastWriteSeq">
              {live.lastWriteSeq === null ? "—" : String(live.lastWriteSeq)}
            </LabeledLine>
            <LabeledLine label="lastWriteVersion">
              {live.lastWriteVersion === null ? "—" : String(live.lastWriteVersion)}
            </LabeledLine>
            <LabeledLine label="lastWriteNode">
              {live.lastWriteNode ?? "—"}
            </LabeledLine>
            <LabeledLine label="node.instance">
              {live.node.instance ?? "—"}
            </LabeledLine>
            <LabeledLine label="node.isLeader">
              {String(live.node.isLeader)}
            </LabeledLine>
            <LabeledLine label="leaderEvaluatedAt">
              {formatMt(live.node.leaderEvaluatedAt) || "—"}
            </LabeledLine>
            <LabeledLine label="cacheRefreshedAt">
              {formatMt(live.node.cacheRefreshedAt) || "—"}
            </LabeledLine>
          </Stack>
        ) : null}
      </CardContent>
      <CardActions>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setConfirm(true)}
          disabled={republishing}
        >
          Republish
        </Button>
      </CardActions>
      <ConfirmDialog
        open={confirm}
        title="Republish live object?"
        body="Force the ingest node to rewrite the CDN live object from the API's authoritative state."
        confirmLabel="Republish"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onRepublish();
        }}
      />
    </Card>
  );
}

function SnapshotCard({
  snap,
  error,
  onRebuild,
  rebuilding,
}: {
  snap: SnapshotInfo | null;
  error: unknown;
  onRebuild: () => void;
  rebuilding: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Snapshot
        </Typography>
        {error ? (
          <ErrorAlert error={error} />
        ) : snap === null ? (
          <Typography variant="body2">Loading…</Typography>
        ) : (
          <Stack spacing={0.5}>
            <LabeledLine label="version">{String(snap.version)}</LabeledLine>
            <LabeledLine label="builtAt">{formatMt(snap.builtAt)}</LabeledLine>
            <LabeledLine label="s3Key">
              <code>{snap.s3Key}</code>
            </LabeledLine>
            <LabeledLine label="url">
              <Link href={snap.url} target="_blank" rel="noopener noreferrer">
                {snap.url}
              </Link>
            </LabeledLine>
          </Stack>
        )}
      </CardContent>
      <CardActions>
        <Button
          size="small"
          variant="outlined"
          onClick={onRebuild}
          disabled={rebuilding}
        >
          Rebuild snapshot
        </Button>
      </CardActions>
    </Card>
  );
}

function LiveObjectCard({
  cdn,
  liveState,
  cookieNames,
  now,
}: {
  cdn: LiveObject | null;
  liveState: LiveState | null;
  cookieNames: Record<string, string>;
  now: number;
}) {
  if (cdn === null) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Live object
          </Typography>
          <Typography variant="body2">CDN object unavailable.</Typography>
        </CardContent>
      </Card>
    );
  }
  const unknownVersion = cdn.schemaVersion !== 1;
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Live object (CDN)
        </Typography>
        {unknownVersion ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            unknown schemaVersion: {String(cdn.schemaVersion)}
          </Alert>
        ) : (
          <Stack spacing={0.5}>
            <LabeledLine label="eventId">
              {cdn.eventId === null ? "—" : String(cdn.eventId)}
            </LabeledLine>
            <LabeledLine label="eventStatusId">
              {cdn.eventStatusId === null ? "—" : String(cdn.eventStatusId)}
            </LabeledLine>
            <LabeledLine label="seq">
              {cdn.seq === null ? "—" : String(cdn.seq)}
            </LabeledLine>
            <LabeledLine label="lat">
              {cdn.lat === null ? "—" : String(cdn.lat)}
            </LabeledLine>
            <LabeledLine label="lng">
              {cdn.lng === null ? "—" : String(cdn.lng)}
            </LabeledLine>
            <LabeledLine label="speedMps">
              {cdn.speedMps === null ? "—" : String(cdn.speedMps)}
            </LabeledLine>
            <LabeledLine label="altitudeM">
              {cdn.altitudeM === null ? "—" : String(cdn.altitudeM)}
            </LabeledLine>
            <LabeledLine label="headingDeg">
              {cdn.headingDeg === null ? "—" : String(cdn.headingDeg)}
            </LabeledLine>
            <LabeledLine label="accuracyM">
              {cdn.accuracyM === null ? "—" : String(cdn.accuracyM)}
            </LabeledLine>
            <LabeledLine label="recordedAt">
              {formatMt(cdn.recordedAt) || "—"}
            </LabeledLine>
            <LabeledLine label="receivedAt">
              {formatMt(cdn.receivedAt) || "—"}
            </LabeledLine>
            <LabeledLine label="publishedAt">
              {formatMt(cdn.publishedAt)}{" "}
              <Box component="span" sx={{ color: "text.secondary" }}>
                ({formatAgeS(ageS(cdn.publishedAt, now))} ago)
              </Box>
            </LabeledLine>
            <LabeledLine label="pollIntervalMs">
              {String(cdn.pollIntervalMs)}
            </LabeledLine>
            <LabeledLine label="snapshotUrl">
              <Link
                href={cdn.snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {cdn.snapshotUrl}
              </Link>
            </LabeledLine>
            <Box>
              <Typography variant="body2" color="text.secondary">
                cookieTally
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 3 }}>
                {Object.entries(cdn.cookieTally).map(([k, v]) => (
                  <li key={k}>
                    <Typography variant="body2">
                      {cookieNames[k] ?? `#${k}`}: {String(v)}
                    </Typography>
                  </li>
                ))}
              </Box>
            </Box>
          </Stack>
        )}
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Raw CDN JSON
          </Typography>
          <ThemedJsonView value={cdn} />
        </Box>
        {liveState ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Node in-memory live
            </Typography>
            <ThemedJsonView value={liveState.node.live} />
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
