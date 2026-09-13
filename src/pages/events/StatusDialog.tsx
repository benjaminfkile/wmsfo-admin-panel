import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Beacon, Event, StatusId } from "../../api/types";
import { keys } from "../../queries/keys";
import { subscribers as subsApi } from "../../api/resources/subscribers";
import { ApiError } from "../../api/errors";
import { statusName } from "../../lib/statusNames";
import { ageS, formatAgeS, formatMt } from "../../lib/time";

interface Props {
  open: boolean;
  event: Event;
  target: StatusId;
  eventsList: Event[];
  activeBeacon: Beacon | null;
  healthyReason: string | null;
  now: number;
  confirming: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: (notifyValue: boolean) => void;
}

type NoHealthyBeaconDetail = {
  beacon?: {
    name?: string | null;
    lastSeenAt?: string | null;
    lastHeartbeatAt?: string | null;
    staleSince?: string | null;
  } | null;
};

function noHealthyBeaconMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code !== "no_healthy_beacon") return null;
  const details = err.body?.details as NoHealthyBeaconDetail | null | undefined;
  const beacon = details?.beacon ?? null;
  if (!beacon) return "No beacon is active";
  const parts: string[] = [];
  parts.push(beacon.name ?? "the active beacon");
  if (beacon.lastSeenAt) parts.push(`last seen ${formatMt(beacon.lastSeenAt)}`);
  if (beacon.staleSince) parts.push(`stale since ${formatMt(beacon.staleSince)}`);
  return parts.join(", ");
}

// Shared status-change dialog for the events list and the dashboard
// (admin.md 6.3).
export default function StatusDialog({
  open,
  event,
  target,
  eventsList,
  activeBeacon,
  healthyReason,
  now,
  confirming,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [notifyChecked, setNotifyChecked] = useState(false);

  const summaryQ = useQuery({
    queryKey: keys.subscribersSummary,
    queryFn: () => subsApi.summary(),
    enabled: open,
  });

  const fromName = statusName(Number(event.statusId));
  const toName = statusName(target);
  const isScheduledOrLive = target === 2 || target === 3;

  let consequence = "";
  if (isScheduledOrLive) {
    if (notifyChecked) {
      const count = summaryQ.data?.verified;
      consequence =
        count === undefined
          ? "Verified subscribers will be emailed"
          : `${count} verified subscribers will be emailed`;
    } else {
      consequence = "No email will be sent";
    }
  } else {
    consequence = "Emails go out only when entering scheduled or live";
  }

  const beaconLine =
    target === 3
      ? activeBeacon
        ? `Active beacon: ${activeBeacon.name}, ${
            activeBeacon.healthy === true ? "healthy" : "unhealthy"
          }, heartbeat ${
            formatAgeS(ageS(activeBeacon.lastHeartbeatAt, now)) || "never"
          }, hub ${
            activeBeacon.hubConnected === true
              ? "connected"
              : activeBeacon.hubConnected === false
                ? "polling"
                : "unknown"
          }`
        : "Active beacon: none"
      : null;

  const anotherEventLive = eventsList.some(
    (e) => e.statusId === 3 && e.id !== event.id
  );

  const gateBlocked = target === 3 && healthyReason !== null;
  const beaconErrorText = noHealthyBeaconMessage(error);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        Change status of {event.name}: {fromName} to {toName}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={notifyChecked}
                onChange={(e) => setNotifyChecked(e.target.checked)}
              />
            }
            label="Notify verified subscribers"
          />
          <DialogContentText>{consequence}</DialogContentText>
          {beaconLine ? (
            <Typography
              variant="body2"
              color={gateBlocked ? "error" : "text.primary"}
            >
              {beaconLine}
            </Typography>
          ) : null}
          {gateBlocked ? (
            <Typography variant="body2" color="error">
              {healthyReason}
            </Typography>
          ) : null}
          {beaconErrorText ? (
            <Alert severity="error">{beaconErrorText}</Alert>
          ) : null}
          {target === 3 && anotherEventLive ? (
            <Typography variant="body2" color="error">
              Another event is already live.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(notifyChecked)}
          disabled={confirming || gateBlocked}
        >
          {target === 3 ? "Set live" : "Change status"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
