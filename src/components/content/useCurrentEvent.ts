import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { InlineEventContext } from "./renderInlinePreview";
import { events as eventsApi } from "../../api/resources/events";
import { keys } from "../../queries/keys";
import type { Event } from "../../api/types";

// Reads the current event from the panel's events list; the same
// approach the dashboard and other pages use. Returns null while
// loading or when no event is current.
export function useCurrentEvent(): InlineEventContext {
  const q = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
    staleTime: 30_000,
  });
  return useMemo<InlineEventContext>(() => {
    const items: Event[] = q.data?.items ?? [];
    const current = items.find((e) => e.isCurrent) ?? null;
    if (!current) return null;
    return {
      name: typeof current.name === "string" ? current.name : "",
      year:
        typeof current.year === "number"
          ? current.year
          : typeof current.year === "string"
            ? Number(current.year)
            : null,
      scheduledAt:
        typeof current.scheduledAt === "string" ? current.scheduledAt : null,
    };
  }, [q.data]);
}
