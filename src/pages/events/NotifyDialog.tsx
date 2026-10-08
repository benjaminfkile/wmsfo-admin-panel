import { useState } from "react";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Stack,
  TextField,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import { useQuery } from "@tanstack/react-query";
import type { Event, StatusId } from "../../api/types";
import { keys } from "../../queries/keys";
import { subscribers as subsApi } from "../../api/resources/subscribers";
import ErrorAlert from "../../components/ErrorAlert";
import EmailQuotaNotice from "../../components/EmailQuotaNotice";
import { stockParagraph } from "../../lib/statusCopy";
import MessageHelper from "./MessageHelper";
import DefaultMessageNotice from "./DefaultMessageNotice";
import { statusName } from "../../lib/statusNames";
import { verifiedLine } from "./verifiedLine";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";

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
// (admin.md 6.3). POSTs to /admin/events/{id}/notify with the typed
// message, null when empty; the API posts it as the event's latest message,
// or the status' stock paragraph when it is null, which the default
// message notice shows.
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
  const consequence = verifiedLine(summaryQ.data?.verified);
  const trimmed = message.trim();
  const send = () => onConfirm(trimmed.length > 0 ? trimmed : null);

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitleWithHelp help="events.detail.notify">
        Notify subscribers of {statusName(statusId)}
      </DialogTitleWithHelp>
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
            helperText={<MessageHelper length={message.length} />}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          {trimmed.length === 0 ? (
            <DefaultMessageNotice
              lead="No message typed. This default message will be emailed:"
              paragraph={placeholder}
            />
          ) : null}
          <EmailQuotaNotice />
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
