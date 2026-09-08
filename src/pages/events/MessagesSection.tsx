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
import { keys } from "../../queries/keys";
import { useNotify } from "../../hooks/useNotify";
import ErrorAlert from "../../components/ErrorAlert";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  fromLocalInputValue,
  formatMt,
  toLocalInputValue,
} from "../../lib/time";
import type { EventMessage } from "../../api/types";

interface Props {
  eventId: number;
}

export default function MessagesSection({ eventId }: Props) {
  const qc = useQueryClient();
  const notify = useNotify();
  const [body, setBody] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [notifyChecked, setNotifyChecked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<EventMessage | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editEventTime, setEditEventTime] = useState("");

  const q = useQuery({
    queryKey: keys.eventMessages(eventId),
    queryFn: () => eventsApi.messages(eventId),
  });

  const postMut = useMutation({
    mutationFn: (b: MessageBody) => eventsApi.postMessage(eventId, b),
    onSuccess: () => {
      notify("Message posted");
      setBody("");
      setEventTime("");
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
      b: Partial<Pick<MessageBody, "body" | "eventTime">>;
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
    postMut.mutate({
      body: trimmed,
      eventTime: fromLocalInputValue(eventTime),
      notify: notifyChecked,
    });
  };

  const startEdit = (m: EventMessage) => {
    setEditingId(Number(m.id));
    setEditBody(m.body ?? "");
    setEditEventTime(toLocalInputValue(m.eventTime));
  };

  const saveEdit = (m: EventMessage) => {
    patchMut.mutate({
      mid: Number(m.id),
      b: {
        body: editBody.trim(),
        eventTime: fromLocalInputValue(editEventTime),
      },
    });
  };

  const messages = [...(q.data?.items ?? [])].sort((a, b) =>
    (a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1
  );

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Messages
        </Typography>

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
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
            <TextField
              label="Event time"
              type="datetime-local"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={
                eventTime ? formatMt(fromLocalInputValue(eventTime)) : "Optional"
              }
            />
            {eventTime ? (
              <Button onClick={() => setEventTime("")}>Clear</Button>
            ) : null}
            <FormControlLabel
              control={
                <Checkbox
                  checked={notifyChecked}
                  onChange={(e) => setNotifyChecked(e.target.checked)}
                />
              }
              label="Notify"
            />
            <Box sx={{ flexGrow: 1 }} />
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
                      <TextField
                        label="Event time"
                        type="datetime-local"
                        value={editEventTime}
                        onChange={(e) => setEditEventTime(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                      />
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
                        {m.eventTime ? formatMt(m.eventTime) + " · " : ""}
                        {m.createdBy} · {formatMt(m.createdAt)}
                      </Typography>
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
