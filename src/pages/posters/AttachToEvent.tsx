import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import type { Event } from "../../api/types";
import { toCopy } from "../../lib/errorMessages";
import { keys } from "../../queries/keys";

interface Props {
  // The ready media asset to attach as an event's route poster.
  mediaId: string;
  disabled?: boolean;
}

type Outcome = { ok: true; name: string } | { ok: false; message: string };

// "Attach to an event" under a generated poster: a picker over the events
// list (`keys.events`), newest year first, and an Attach button that sends
// PATCH /admin/events/{id} { routeImageMediaId }. A success names the
// event and the picker and the button stay, so the same image can go to
// another event; a failure shows the reason.
export default function AttachToEvent({ mediaId, disabled = false }: Props) {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState<number | "">("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const eventsResult = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });
  const list = useMemo(() => newestFirst(eventsResult.data?.items ?? []), [eventsResult.data]);

  const attach = useMutation({
    mutationFn: (event: Event) =>
      eventsApi.patch(Number(event.id), { routeImageMediaId: mediaId }),
    onMutate: () => setOutcome(null),
    onSuccess: (_answer, event) => {
      setOutcome({ ok: true, name: eventName(event) });
      void qc.invalidateQueries({ queryKey: keys.event(Number(event.id)) });
      void qc.invalidateQueries({ queryKey: keys.events });
    },
    onError: (e, event) => {
      setOutcome({
        ok: false,
        message: `The poster could not be attached to ${eventName(event)}. ${toCopy(e).message}`,
      });
    },
  });

  const picked = list.find((e) => Number(e.id) === eventId) ?? null;

  return (
    <Stack spacing={1} data-testid="poster-attach">
      <FormControl size="small" disabled={disabled || attach.isPending} sx={{ minWidth: 200 }}>
        <InputLabel id="poster-attach-event">Event</InputLabel>
        <Select
          labelId="poster-attach-event"
          label="Event"
          value={eventId}
          onChange={(e) => setEventId(Number(e.target.value))}
          data-testid="poster-attach-event"
        >
          {list.map((e) => (
            <MenuItem key={String(e.id)} value={Number(e.id)}>
              {eventName(e)} ({String(e.year)})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="outlined"
        disabled={disabled || picked === null || attach.isPending}
        onClick={() => {
          if (picked) attach.mutate(picked);
        }}
        data-testid="poster-attach-run"
        sx={{ alignSelf: "flex-start" }}
      >
        Attach to an event
      </Button>
      {eventsResult.isError ? (
        <Alert severity="error" data-testid="poster-attach-events-error">
          The events could not load. {toCopy(eventsResult.error).message}
        </Alert>
      ) : null}
      {outcome?.ok ? (
        <Alert severity="success" data-testid="poster-attach-success">
          Attached to {outcome.name} as its route poster.
        </Alert>
      ) : outcome ? (
        <Alert severity="error" data-testid="poster-attach-error">
          {outcome.message}
        </Alert>
      ) : null}
    </Stack>
  );
}

// The events by year, newest first; the same year keeps the higher id first.
function newestFirst(items: readonly Event[]): Event[] {
  return [...items].sort(
    (a, b) => Number(b.year) - Number(a.year) || Number(b.id) - Number(a.id),
  );
}

function eventName(event: Event): string {
  return event.name || `Event ${String(event.id)}`;
}
