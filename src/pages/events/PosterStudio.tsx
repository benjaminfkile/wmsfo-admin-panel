import { Alert, Button, Link, Typography } from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import type { Event } from "../../api/types";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import { useConfig } from "../../ConfigContext";
import { keys } from "../../queries/keys";
import { routeBasemapBase } from "../../routeMap";
import PosterStudioWorkspace from "./PosterStudioWorkspace";

export const NO_RECORDING_HINT = "Link a flight recording to this event to generate a poster.";
export const NO_BASEMAP_HINT =
  "Poster generation needs VITE_ROUTE_BASEMAP_URL, which is not set.";

// The poster studio page, /events/:id/poster (admin.md 6.3). The header
// names the event and links back to it. While the event has no linked
// recording or the basemap URL is unset, a short hint stands in place of
// the workspace.
export default function PosterStudio() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const config = useConfig();
  const eventQ = useQuery({
    queryKey: keys.event(id),
    queryFn: () => eventsApi.get(id),
    enabled: Number.isFinite(id),
  });
  const event = eventQ.data ?? null;

  if (eventQ.isLoading) {
    return <Typography>Loading…</Typography>;
  }
  if (eventQ.error || !event) {
    return <ErrorAlert error={eventQ.error ?? new Error("Event not found")} />;
  }

  const hint = studioHint(event, routeBasemapBase(config) !== null);
  const eventPath = `/events/${id}`;

  return (
    <>
      <PageHeader
        title="Poster studio"
        subtitle={
          <Link component={RouterLink} to={eventPath} data-testid="poster-studio-event-link">
            {event.name ?? `Event ${id}`}
          </Link>
        }
        actions={
          <Button component={RouterLink} to={eventPath} data-testid="poster-studio-back">
            Back to event
          </Button>
        }
      />
      {hint ? (
        <Alert severity="info" data-testid="poster-studio-hint">
          {hint}
        </Alert>
      ) : (
        <PosterStudioWorkspace event={event} />
      )}
    </>
  );
}

function studioHint(event: Event, hasBasemap: boolean): string | null {
  if (event.routeId === null || event.routeId === undefined) return NO_RECORDING_HINT;
  if (!hasBasemap) return NO_BASEMAP_HINT;
  return null;
}
