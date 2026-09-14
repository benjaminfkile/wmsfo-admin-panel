import { useState } from "react";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import { useQuery } from "@tanstack/react-query";
import type { Event, StatusId } from "../../api/types";
import { keys } from "../../queries/keys";
import { subscribers as subsApi } from "../../api/resources/subscribers";
import ErrorAlert from "../../components/ErrorAlert";
import { stockParagraph } from "../../lib/statusCopy";
import { statusName } from "../../lib/statusNames";

interface Props {
  open: boolean;
  event: Event;
  confirming: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: (message: string | null) => void;
}

// Announce-again dialog opened from the "Notify subscribers" button on
// the status card when nobody was told about the current status
// (admin.md 6.3). POSTs to /admin/events/{id}/notify.
export default function NotifyDialog({
  open,
  event,
  confirming,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [message, setMessage] = useState("");
  const summaryQ = useQuery({
    queryKey: keys.subscribersSummary,
    queryFn: () => subsApi.summary(),
    enabled: open,
  });
  const statusId = Number(event.statusId) as StatusId;
  const placeholder = stockParagraph(
    statusId,
    event.name ?? "",
    event.scheduledAt ?? null
  );
  const verified = summaryQ.data?.verified;
  const consequence =
    verified === undefined
      ? "Verified subscribers will be emailed"
      : `${verified} verified subscribers will be emailed`;
  const trimmed = message.trim();
  const send = () => onConfirm(trimmed.length > 0 ? trimmed : null);

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Notify subscribers of {statusName(statusId)}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <ErrorAlert error={error} /> : null}
          <DialogContentText>{consequence}</DialogContentText>
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={send} disabled={confirming}>
          Send now
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
