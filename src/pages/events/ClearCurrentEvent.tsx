import { useState } from "react";
import { Alert, Button, DialogContentText, Stack, Typography } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import type { Event } from "../../api/types";
import { ApiError } from "../../api/errors";
import { keys } from "../../queries/keys";
import { useAuth } from "../../auth/AuthProvider";
import { useNotify } from "../../hooks/useNotify";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";

export const LIVE_STAYS_CURRENT = "A live event stays current.";

// The "Clear current event" control beside the current marker on the
// event page: shown to an admin on the current event only, disabled
// while the event is live. Confirming calls DELETE
// /admin/events/{id}/current, so no event is current and the site
// shows the Off season (no_event) page.
export default function ClearCurrentEvent({ event }: { event: Event }) {
  const { state } = useAuth();
  const isAdmin = state.kind === "member" && state.role === "admin";
  const qc = useQueryClient();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const id = Number(event.id);
  const live = Number(event.statusId) === 3;

  const clearMut = useMutation({
    mutationFn: () => eventsApi.clearCurrent(id),
    onSuccess: () => {
      notify("No event is current");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: keys.events });
    },
  });

  if (!isAdmin || !event.isCurrent) return null;

  const error = clearMut.error;
  const liveConflict =
    error instanceof ApiError && error.code === "current_event_live";

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            clearMut.reset();
            setOpen(true);
          }}
          disabled={live}
          aria-describedby={live ? "clear-current-helper" : undefined}
        >
          Clear current event
        </Button>
        {live ? (
          <Typography
            id="clear-current-helper"
            variant="caption"
            color="text.secondary"
          >
            {LIVE_STAYS_CURRENT}
          </Typography>
        ) : null}
      </Stack>
      <ConfirmDialog
        open={open}
        title="Clear current event?"
        body={
          <Stack spacing={2}>
            {liveConflict ? (
              <Alert severity="error" role="alert">
                {LIVE_STAYS_CURRENT}
              </Alert>
            ) : error ? (
              <ErrorAlert error={error} />
            ) : null}
            <DialogContentText>
              {`With no current event, the site shows the Off season page. Clear ${event.name ?? "this event"} as the current event?`}
            </DialogContentText>
          </Stack>
        }
        confirmLabel="Clear current event"
        help="events.set-current"
        disabled={clearMut.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() => clearMut.mutate()}
      />
    </>
  );
}
