import { useState } from "react";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { Event } from "../../api/types";
import {
  routeMapConfigSummary,
  toRouteMapConfig,
} from "../../routeMap/eventRouteMap";
import RouteMapConfigDialog from "./RouteMapConfigDialog";
import CardTitle from "../../help/CardTitle";

interface Props {
  event: Event;
}

// The Route map card on the event detail page: each setting of the
// event's `routeMapConfig` that differs from its default as a chip, and
// "Configure route map", which opens RouteMapConfigDialog. The dialog mounts only while open, so each open
// starts from the saved config.
export default function RouteMapSection({ event }: Props) {
  const [open, setOpen] = useState(false);
  const summary = routeMapConfigSummary(toRouteMapConfig(event.routeMapConfig));
  const noRecording = event.routeId === null || event.routeId === undefined;

  return (
    <Card data-testid="route-map-card">
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ mb: 1 }}
        >
          <CardTitle help="events.detail.route-map">Route map</CardTitle>
          <Button variant="outlined" onClick={() => setOpen(true)}>
            Configure route map
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          How the site draws this event&apos;s route: the line, its labels, and the map
          buttons.
        </Typography>
        {summary.changed.length === 0 ? (
          <Typography variant="body2" data-testid="route-map-changed">
            Every setting is at its default.
          </Typography>
        ) : (
          <Box data-testid="route-map-changed">
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Differs from the default:
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {summary.changed.map((c) => (
                <Chip key={c.label} size="small" label={`${c.label}: ${c.value}`} />
              ))}
            </Stack>
          </Box>
        )}
        {noRecording ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            No flight recording is linked, so the preview stays empty until one is.
          </Typography>
        ) : null}
      </CardContent>
      {open ? <RouteMapConfigDialog event={event} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}
