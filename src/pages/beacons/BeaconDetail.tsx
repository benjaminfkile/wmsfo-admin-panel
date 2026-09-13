import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { beacons as beaconsApi } from "../../api/resources/beacons";
import type { KeyMint } from "../../api/resources/beacons";
import { events as eventsApi } from "../../api/resources/events";
import { keys } from "../../queries/keys";
import { polled } from "../../queries/polling";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import FlagChip from "../../components/FlagChip";
import KeyRevealDialog from "../../components/KeyRevealDialog";
import { useNotify } from "../../hooks/useNotify";
import { useNow } from "../../hooks/useNow";
import { ageS, formatAgeS, formatMt } from "../../lib/time";
import { beaconFlags } from "../../lib/beaconFlags";
import type { Beacon } from "../../api/types";
import TelemetryPanel from "./TelemetryPanel";
import BeaconLogs from "./BeaconLogs";

type Action = "activate" | "deactivate" | "rotate" | "revoke";

export default function BeaconDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const notify = useNotify();
  const now = useNow();

  const beaconsQ = useQuery({
    queryKey: keys.beacons,
    queryFn: () => beaconsApi.list(),
    ...polled,
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const [keyMint, setKeyMint] = useState<KeyMint | null>(null);
  const [keyMintTitle, setKeyMintTitle] = useState("Beacon key");
  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const invalidateBeacons = () =>
    void qc.invalidateQueries({ queryKey: keys.beacons });

  const beacon: Beacon | null = useMemo(() => {
    const items = beaconsQ.data?.items ?? [];
    return items.find((b) => Number(b.id) === id) ?? null;
  }, [beaconsQ.data, id]);

  const events = eventsQ.data?.items ?? [];
  const anyEventLive = events.some((e) => Number(e.statusId) === 3);
  const staleAfterS = Number(beaconsQ.data?.staleAfterS ?? 60);

  useEffect(() => {
    if (beacon && !editing) {
      setFormName(beacon.name ?? "");
      setFormNotes(beacon.notes ?? "");
      setErrors({});
    }
  }, [beacon, editing]);

  const patchMut = useMutation({
    mutationFn: (b: Partial<{ name: string; notes: string }>) =>
      beaconsApi.patch(id, b),
    onSuccess: () => {
      notify("Beacon saved");
      invalidateBeacons();
      setEditing(false);
    },
  });

  const activateMut = useMutation({
    mutationFn: () => beaconsApi.activate(id),
    onSuccess: () => {
      notify("Beacon activated");
      invalidateBeacons();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Activate failed", "error"),
    onSettled: () => setConfirmAction(null),
  });
  const deactivateMut = useMutation({
    mutationFn: () => beaconsApi.deactivate(id),
    onSuccess: () => {
      notify("Beacon deactivated");
      invalidateBeacons();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Deactivate failed", "error"),
    onSettled: () => setConfirmAction(null),
  });
  const rotateMut = useMutation({
    mutationFn: () => beaconsApi.rotate(id),
    onSuccess: (mint) => {
      notify("Key rotated");
      invalidateBeacons();
      setKeyMintTitle(`Rotated key for ${mint.beacon.name ?? "beacon"}`);
      setKeyMint(mint);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Rotate failed", "error"),
    onSettled: () => setConfirmAction(null),
  });
  const revokeMut = useMutation({
    mutationFn: () => beaconsApi.revoke(id),
    onSuccess: () => {
      notify("Beacon revoked");
      invalidateBeacons();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Revoke failed", "error"),
    onSettled: () => setConfirmAction(null),
  });

  if (beaconsQ.isLoading) {
    return <Typography>Loading…</Typography>;
  }
  if (beaconsQ.error) {
    return <ErrorAlert error={beaconsQ.error} />;
  }
  if (!beacon) {
    return <Alert severity="warning">Beacon not found</Alert>;
  }

  const revoked = beacon.revokedAt !== null && beacon.revokedAt !== undefined;
  const flags = beaconFlags(beacon, staleAfterS, anyEventLive, now);
  const flagSet = new Set(flags);
  const isHealthy = beacon.healthy === true;

  const save = () => {
    const trimmedName = formName.trim();
    const trimmedNotes = formNotes.trim();
    const next: Record<string, string> = {};
    if (trimmedName.length < 1) next.name = "Name is required";
    else if (trimmedName.length > 100)
      next.name = "Name must be 100 characters or fewer";
    if (trimmedNotes.length > 2000)
      next.notes = "Notes must be 2000 characters or fewer";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const changes: Partial<{ name: string; notes: string }> = {};
    if (trimmedName !== (beacon.name ?? "")) changes.name = trimmedName;
    if (trimmedNotes !== (beacon.notes ?? "")) changes.notes = trimmedNotes;
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    patchMut.mutate(changes);
  };

  const runAction = () => {
    if (!confirmAction) return;
    if (confirmAction === "activate") activateMut.mutate();
    else if (confirmAction === "deactivate") deactivateMut.mutate();
    else if (confirmAction === "rotate") rotateMut.mutate();
    else if (confirmAction === "revoke") revokeMut.mutate();
  };

  const confirmSpec = confirmAction
    ? confirmSpecFor(confirmAction, beacon, anyEventLive)
    : null;

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {beacon.name}
        </Typography>
        <Box component="code">{beacon.keyPrefix}</Box>
        {revoked ? (
          <Chip size="small" color="default" label="Revoked" />
        ) : beacon.isActive ? (
          <Chip size="small" color="success" label="Active" />
        ) : null}
        {!revoked ? (
          <Chip
            size="small"
            label={isHealthy ? "Healthy" : "Unhealthy"}
            color={isHealthy ? "success" : "error"}
          />
        ) : null}
      </Stack>

      {revoked ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This beacon was revoked at {formatMt(beacon.revokedAt)}. It cannot
          be used.
        </Alert>
      ) : null}

      {!revoked && flags.length > 0 ? (
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          {flags.map((f) => (
            <FlagChip key={f} flag={f} />
          ))}
        </Stack>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Details
                </Typography>
                {!editing ? (
                  <Button size="small" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                ) : null}
              </Stack>
              {patchMut.error ? (
                <ErrorAlert
                  error={patchMut.error}
                  handledFields={Object.keys(errors)}
                />
              ) : null}
              <Stack spacing={2}>
                <TextField
                  label="Name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={!editing}
                  error={!!errors.name}
                  helperText={errors.name ?? ""}
                  fullWidth
                />
                <TextField
                  label="Notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  disabled={!editing}
                  error={!!errors.notes}
                  helperText={errors.notes ?? ""}
                  fullWidth
                  multiline
                  rows={3}
                />
                <Stack direction="row" spacing={1}>
                  {editing ? (
                    <>
                      <Button
                        variant="contained"
                        onClick={save}
                        disabled={patchMut.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => {
                          setEditing(false);
                          setFormName(beacon.name ?? "");
                          setFormNotes(beacon.notes ?? "");
                          setErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created by {beacon.createdBy} on {formatMt(beacon.createdAt)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actions
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {!revoked && !beacon.isActive ? (
                  <Button
                    variant="outlined"
                    onClick={() => setConfirmAction("activate")}
                  >
                    Activate
                  </Button>
                ) : null}
                {!revoked && beacon.isActive ? (
                  <Button
                    variant="outlined"
                    onClick={() => setConfirmAction("deactivate")}
                  >
                    Deactivate
                  </Button>
                ) : null}
                {!revoked ? (
                  <Button
                    variant="outlined"
                    onClick={() => setConfirmAction("rotate")}
                  >
                    Rotate key
                  </Button>
                ) : null}
                {!revoked ? (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setConfirmAction("revoke")}
                  >
                    Revoke
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ages
              </Typography>
              <Stack spacing={0.5}>
                <AgeLine
                  label="lastSeenAt"
                  iso={beacon.lastSeenAt ?? null}
                  now={now}
                />
                <AgeLine
                  label="lastHeartbeatAt"
                  iso={beacon.lastHeartbeatAt ?? null}
                  now={now}
                  coloured={flagSet.has("heartbeat_old")}
                />
                <AgeLine
                  label="lastLocationAt"
                  iso={beacon.lastLocationAt ?? null}
                  now={now}
                />
                <AgeLine
                  label="staleSince"
                  iso={beacon.staleSince ?? null}
                  now={now}
                  coloured={flagSet.has("stale")}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Telemetry
              </Typography>
              <TelemetryPanel
                beacon={beacon}
                staleAfterS={staleAfterS}
                anyEventLive={anyEventLive}
                now={now}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <Card>
            <CardContent>
              <BeaconLogs beaconId={id} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {confirmSpec ? (
        <ConfirmDialog
          open={true}
          title={confirmSpec.title}
          body={confirmSpec.body}
          confirmLabel={confirmSpec.confirmLabel}
          danger={confirmSpec.danger}
          disabled={
            activateMut.isPending ||
            deactivateMut.isPending ||
            rotateMut.isPending ||
            revokeMut.isPending
          }
          onCancel={() => setConfirmAction(null)}
          onConfirm={runAction}
        />
      ) : null}

      {keyMint ? (
        <KeyRevealDialog
          open={true}
          title={keyMintTitle}
          beaconKey={keyMint.key}
          enrollment={keyMint.enrollment}
          onClose={() => setKeyMint(null)}
        />
      ) : null}
    </>
  );
}

function AgeLine({
  label,
  iso,
  now,
  coloured = false,
}: {
  label: string;
  iso: string | null;
  now: number;
  coloured?: boolean;
}) {
  const age = ageS(iso, now);
  const ageText = formatAgeS(age) || "never";
  return (
    <Typography
      variant="body2"
      component="div"
      color={coloured ? "error" : "text.primary"}
    >
      <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
        {label}:
      </Box>
      {ageText}
      {iso ? (
        <Box component="span" sx={{ color: "text.secondary", ml: 1 }}>
          ({formatMt(iso)})
        </Box>
      ) : null}
    </Typography>
  );
}

function confirmSpecFor(
  action: Action,
  beacon: Beacon,
  anyEventLive: boolean
): {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
} {
  const name = beacon.name ?? "beacon";
  const isActive = beacon.isActive === true;
  const liveNote =
    isActive && anyEventLive
      ? " Location fan-out stops until another beacon is activated."
      : "";
  switch (action) {
    case "activate":
      return {
        title: "Activate beacon?",
        body: `Activate ${name}? Only its updates are published, starting with its next update.`,
        confirmLabel: "Activate",
      };
    case "deactivate":
      return {
        title: "Deactivate beacon?",
        body: `Deactivate ${name}?${liveNote}`,
        confirmLabel: "Deactivate",
      };
    case "rotate": {
      const rotateLive =
        isActive && anyEventLive
          ? " Location fan-out stops until this phone is re-enrolled with the new key or another beacon is activated."
          : "";
      return {
        title: "Rotate key?",
        body: `Rotate the key for ${name}? The current key stops working immediately and the phone must be re-enrolled with the new key.${rotateLive}`,
        confirmLabel: "Rotate",
        danger: true,
      };
    }
    case "revoke":
      return {
        title: "Revoke beacon?",
        body: `Revoke ${name}? This is permanent.${liveNote}`,
        confirmLabel: "Revoke",
        danger: true,
      };
  }
}
