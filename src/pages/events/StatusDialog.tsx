import { useState } from "react";
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import { useQuery } from "@tanstack/react-query";
import type { Beacon, Event, StatusId } from "../../api/types";
import { keys } from "../../queries/keys";
import { subscribers as subsApi } from "../../api/resources/subscribers";
import { ApiError } from "../../api/errors";
import { statusName } from "../../lib/statusNames";
import { stockParagraph } from "../../lib/statusCopy";
import { ageS, formatAgeS, formatMt } from "../../lib/time";
import { useCompact } from "../../hooks/useCompact";

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
  onConfirm: (args: { notify: boolean; message: string | null }) => void;
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

// Shared status-change dialog for the event page and the dashboard
// (admin.md 6.3). The admin picks Change and notify (sends notify: true
// with the message when typed) or Change without notifying (sends
// notify: false through a nested confirmation).
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
  const [message, setMessage] = useState("");
  const [askSilent, setAskSilent] = useState(false);
  const compact = useCompact();
  const stackedActionsSx = compact
    ? {
        flexDirection: "column" as const,
        alignItems: "stretch" as const,
        "& > :not(:first-of-type)": { ml: 0 },
        "& > *": { width: "100%" },
      }
    : undefined;

  const summaryQ = useQuery({
    queryKey: keys.subscribersSummary,
    queryFn: () => subsApi.summary(),
    enabled: open,
  });

  const fromName = statusName(Number(event.statusId));
  const toName = statusName(target);
  const placeholder = stockParagraph(target, event.name ?? "", event.scheduledAt ?? null);

  const verifiedCount = summaryQ.data?.verified;
  const consequence =
    verifiedCount === undefined
      ? "Verified subscribers will be emailed"
      : `${verifiedCount} verified subscribers will be emailed`;

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

  const trimmedMessage = message.trim();
  const messageToSend = trimmedMessage.length > 0 ? trimmedMessage : null;

  const doConfirm = (notifyValue: boolean) => {
    onConfirm({ notify: notifyValue, message: messageToSend });
  };

  return (
    <>
      <AppDialog open={open && !askSilent} onClose={onCancel} maxWidth="sm" fullWidth>
        <DialogTitle>
          Change status of {event.name}: {fromName} to {toName}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Message (optional)"
              multiline
              minRows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              placeholder={placeholder}
              inputProps={{ maxLength: 1000 }}
              helperText={`${message.length} / 1000`}
              InputLabelProps={{ shrink: true }}
              fullWidth
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
        <DialogActions sx={stackedActionsSx} data-testid="status-dialog-actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => setAskSilent(true)}
            disabled={confirming || gateBlocked}
          >
            Change without notifying
          </Button>
          <Button
            variant="contained"
            onClick={() => doConfirm(true)}
            disabled={confirming || gateBlocked}
          >
            Change and notify
          </Button>
        </DialogActions>
      </AppDialog>
      <AppDialog
        open={open && askSilent}
        onClose={() => setAskSilent(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Change the status without telling subscribers?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You can notify them later from the event page.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAskSilent(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              setAskSilent(false);
              doConfirm(false);
            }}
            disabled={confirming}
          >
            Change without notifying
          </Button>
        </DialogActions>
      </AppDialog>
    </>
  );
}
