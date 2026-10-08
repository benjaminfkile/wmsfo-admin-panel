import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import type { MessageBody } from "../../api/resources/events";
import { subscribers as subsApi } from "../../api/resources/subscribers";
import { keys } from "../../queries/keys";
import { useNotify } from "../../hooks/useNotify";
import { useCompact } from "../../hooks/useCompact";
import ErrorAlert from "../../components/ErrorAlert";
import EmailQuotaNotice from "../../components/EmailQuotaNotice";
import ConfirmDialog from "../../components/ConfirmDialog";
import { formatStamp } from "../../lib/time";
import type { EventMessage } from "../../api/types";
import { historyPollInterval } from "./historyPolling";
import { verifiedLine } from "./verifiedLine";
import CardTitle from "../../help/CardTitle";

interface Props {
  eventId: number;
  // The tallest the card may grow on desktop (the Status card's height);
  // null leaves it uncapped.
  maxHeight: number | null;
}

export default function MessagesSection({ eventId, maxHeight }: Props) {
  const compact = useCompact();
  const qc = useQueryClient();
  const notify = useNotify();
  const [body, setBody] = useState("");
  const [notifyChecked, setNotifyChecked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<EventMessage | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");

  const summaryQ = useQuery({
    queryKey: keys.subscribersSummary,
    queryFn: () => subsApi.summary(),
  });
  const verified = summaryQ.data?.verified;

  // Polls while the newest notified message's sent count fills in.
  const q = useQuery({
    queryKey: keys.eventMessages(eventId),
    queryFn: () => eventsApi.messages(eventId),
    refetchInterval: (query) =>
      historyPollInterval(
        (query.state.data?.items ?? []).map((m) => ({
          notify: m.notify,
          changedAt: m.createdAt,
          sentCount: m.sentCount,
        })),
        verified
      ),
  });

  const postMut = useMutation({
    mutationFn: (b: MessageBody) => eventsApi.postMessage(eventId, b),
    onSuccess: (_data, b) => {
      notify(
        !b.notify
          ? "Message posted"
          : verified === undefined
            ? "Message posted, notifying subscribers"
            : `Message posted, notifying ${verified} subscribers`
      );
      setBody("");
      setNotifyChecked(false);
      setErrors({});
      void qc.invalidateQueries({ queryKey: keys.eventMessages(eventId) });
    },
  });

  const patchMut = useMutation({
    mutationFn: ({
      mid,
      b,
    }: {
      mid: number;
      b: Pick<MessageBody, "body">;
    }) => eventsApi.patchMessage(eventId, mid, b),
    onSuccess: () => {
      notify("Message updated");
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: keys.eventMessages(eventId) });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (mid: number) => eventsApi.deleteMessage(eventId, mid),
    onSuccess: () => {
      notify("Message deleted");
      setConfirmDelete(null);
      void qc.invalidateQueries({ queryKey: keys.eventMessages(eventId) });
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    const trimmed = body.trim();
    if (trimmed.length < 1) next.body = "Message is required";
    else if (trimmed.length > 1000) next.body = "1000 characters or fewer";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    postMut.mutate({ body: trimmed, notify: notifyChecked });
  };

  const startEdit = (m: EventMessage) => {
    setEditingId(Number(m.id));
    setEditBody(m.body ?? "");
  };

  const saveEdit = (m: EventMessage) => {
    patchMut.mutate({
      mid: Number(m.id),
      b: { body: editBody.trim() },
    });
  };

  const messages = [...(q.data?.items ?? [])].sort((a, b) =>
    (a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1
  );

  // On desktop with a height the card is a flex column capped at it: the
  // title and the post form stay at the top and the list box takes the rest
  // and scrolls. On compact the list box is capped at 320 px and scrolls.
  const capped = !compact && maxHeight !== null;

  return (
    <Card
      sx={
        capped
          ? { maxHeight, display: "flex", flexDirection: "column" }
          : undefined
      }
    >
      <CardContent
        sx={
          capped
            ? {
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }
            : undefined
        }
      >
        <CardTitle help="events.detail.messages" gutterBottom>
          Messages
        </CardTitle>

        <Stack spacing={2} sx={{ mb: 3 }}>
          {postMut.error ? (
            <ErrorAlert
              error={postMut.error}
              handledFields={Object.keys(errors)}
            />
          ) : null}
          <TextField
            label="Body"
            multiline
            minRows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            error={!!errors.body}
            helperText={errors.body ?? ""}
            fullWidth
          />
          {notifyChecked ? (
            <>
              <Typography variant="body2" data-testid="message-verified-line">
                {verifiedLine(verified)}
              </Typography>
              <EmailQuotaNotice />
            </>
          ) : null}
          <Stack
            direction="row"
            spacing={2}
            useFlexGap
            flexWrap="wrap"
            alignItems="flex-start"
            data-testid="message-post-actions"
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={notifyChecked}
                  onChange={(e) => setNotifyChecked(e.target.checked)}
                />
              }
              label="Notify"
            />
            <Button
              variant="contained"
              onClick={submit}
              disabled={postMut.isPending}
            >
              Post
            </Button>
          </Stack>
        </Stack>

        {q.error ? <ErrorAlert error={q.error} /> : null}
        <Box
          data-testid="messages-list"
          sx={
            compact
              ? { maxHeight: 320, overflowY: "auto" }
              : capped
                ? { flex: "1 1 auto", minHeight: 0, overflowY: "auto" }
                : undefined
          }
        >
          <Stack spacing={1}>
            {messages.map((m) => (
              <Card key={String(m.id)} variant="outlined">
                <CardContent>
                  {editingId === Number(m.id) ? (
                    <Stack spacing={2}>
                      <TextField
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        multiline
                        minRows={2}
                        fullWidth
                      />
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Button
                          size="small"
                          startIcon={<SaveIcon />}
                          onClick={() => saveEdit(m)}
                          disabled={patchMut.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          startIcon={<CloseIcon />}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack direction="row" alignItems="flex-start" spacing={2}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                          {m.body}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.createdBy} · {formatStamp(m.createdAt)}
                        </Typography>
                        {m.notify === true ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                            data-testid="message-notified"
                          >
                            {`Notified · ${String(m.sentCount ?? 0)} sent`}
                          </Typography>
                        ) : null}
                      </Box>
                      <IconButton
                        size="small"
                        aria-label="Edit"
                        onClick={() => startEdit(m)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete"
                        onClick={() => setConfirmDelete(m)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      </CardContent>
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete message?"
        body="Delete message? This cannot be undone."
        confirmLabel="Delete"
        danger
        disabled={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() =>
          confirmDelete && deleteMut.mutate(Number(confirmDelete.id))
        }
      />
    </Card>
  );
}
