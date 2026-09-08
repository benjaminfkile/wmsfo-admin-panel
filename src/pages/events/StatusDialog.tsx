import { useState } from "react";
import {
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
import { statusName } from "../../lib/statusNames";
import { ageS, formatAgeS } from "../../lib/time";

interface Props {
  open: boolean;
  event: Event;
  target: StatusId;
  eventsList: Event[];
  activeBeacon: Beacon | null;
  now: number;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: (notifyValue: boolean) => void;
}

// Shared status-change dialog for the events list and the dashboard
// (admin.md 6.3).
export default function StatusDialog({
  open,
  event,
  target,
  eventsList,
  activeBeacon,
  now,
  confirming,
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
        ? `Active beacon: ${activeBeacon.name}, heartbeat ${
            formatAgeS(ageS(activeBeacon.lastHeartbeatAt, now)) || "never"
          }, stale: ${activeBeacon.staleSince ? "yes" : "no"}`
        : "Active beacon: none"
      : null;

  const anotherEventLive = eventsList.some(
    (e) => e.statusId === 3 && e.id !== event.id
  );

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
            <Typography variant="body2">{beaconLine}</Typography>
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
          disabled={confirming}
        >
          {target === 3 ? "Set live" : "Change status"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
