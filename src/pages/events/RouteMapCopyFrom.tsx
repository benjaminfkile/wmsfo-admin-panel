import { useMemo, useState } from "react";
import { Alert, Box, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import type { Event } from "../../api/types";
import { keys } from "../../queries/keys";
import {
  routeMapConfigBody,
  toRouteMapConfig,
  type RouteMapConfigValue,
} from "../../routeMap/eventRouteMap";

interface Props {
  // The event being edited; it is left out of the list.
  eventId: number;
  disabled?: boolean;
  // Called with the picked event's config (an empty object when it has
  // none); the caller loads it into its draft.
  onPick: (config: RouteMapConfigValue) => void;
}

interface Candidate {
  id: number;
  name: string;
  year: number;
  config: RouteMapConfigValue;
  hasConfig: boolean;
}

function toCandidate(e: Event): Candidate {
  const config = toRouteMapConfig(e.routeMapConfig);
  const year = Number(e.year);
  return {
    id: Number(e.id),
    name: e.name ?? `Event ${String(e.id)}`,
    year: Number.isFinite(year) ? year : 0,
    config,
    hasConfig: routeMapConfigBody(config) !== null,
  };
}

// "Copy from another event": a select over every other event from
// `GET /admin/events`, newest year first, each marked with whether it
// has route map settings. Picking one hands its `routeMapConfig` to
// `onPick` and shows what was loaded; nothing is written here.
export default function RouteMapCopyFrom({ eventId, disabled = false, onPick }: Props) {
  const eventsQ = useQuery({ queryKey: keys.events, queryFn: () => eventsApi.list() });
  const [picked, setPicked] = useState<Candidate | null>(null);

  const candidates = useMemo(
    () =>
      (eventsQ.data?.items ?? [])
        .map(toCandidate)
        .filter((c) => c.id !== eventId)
        .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name)),
    [eventsQ.data, eventId]
  );

  return (
    <Stack spacing={1} data-testid="route-map-copy-from">
      <TextField
        select
        fullWidth
        size="small"
        label="Event"
        value={picked ? String(picked.id) : ""}
        disabled={disabled || candidates.length === 0}
        helperText={
          eventsQ.isError
            ? "The events could not load."
            : candidates.length === 0 && eventsQ.isSuccess
              ? "There is no other event to copy from."
              : "Loads that event's settings here for review; Save keeps them."
        }
        onChange={(e) => {
          const next = candidates.find((c) => String(c.id) === e.target.value) ?? null;
          setPicked(next);
          if (next) onPick(next.config);
        }}
        slotProps={{
          inputLabel: { shrink: true },
          select: {
            displayEmpty: true,
            renderValue: (v) =>
              v === ""
                ? "Choose an event"
                : (candidates.find((c) => String(c.id) === v)?.name ?? ""),
          },
        }}
      >
        {candidates.map((c) => (
          <MenuItem
            key={c.id}
            value={String(c.id)}
            data-testid={`route-map-copy-option-${c.id}`}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">
                {c.year} {c.name}
              </Typography>
              <Typography
                variant="caption"
                color={c.hasConfig ? "primary" : "text.secondary"}
                component="p"
              >
                {c.hasConfig ? "Has route map settings" : "No route map settings"}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </TextField>
      {picked ? (
        <Alert severity="info" data-testid="route-map-copy-loaded">
          {picked.hasConfig
            ? `Loaded the route map settings of ${picked.name}. Review them, then Save to keep them.`
            : `${picked.name} has no route map settings, so every setting shows its default. Save to keep that.`}
        </Alert>
      ) : null}
    </Stack>
  );
}
