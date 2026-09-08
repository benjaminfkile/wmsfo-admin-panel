import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/errors";
import { events as eventsApi } from "../../api/resources/events";
import { routes as routesApi } from "../../api/resources/routes";
import type { RouteUploadBody } from "../../api/resources/routes";
import type { Event, Route } from "../../api/types";
import { keys } from "../../queries/keys";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import ErrorAlert from "../../components/ErrorAlert";
import RouteUploadDialog from "./RouteUploadDialog";

interface Props {
  event: Event;
}

export default function RouteSection({ event }: Props) {
  const qc = useQueryClient();
  const notify = useNotify();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [chooseId, setChooseId] = useState<number | "">("");

  const routesQ = useQuery({
    queryKey: keys.routes,
    queryFn: () => routesApi.list(),
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const patchMut = useMutation({
    mutationFn: (routeId: number | null) =>
      eventsApi.patch(Number(event.id), { routeId }),
    onSuccess: () => {
      notify("Route updated");
      void qc.invalidateQueries({ queryKey: keys.event(Number(event.id)) });
      void qc.invalidateQueries({ queryKey: keys.events });
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Route update failed", "error"),
  });

  const uploadMut = useMutation({
    mutationFn: async (body: RouteUploadBody) => {
      const route = await routesApi.create(body);
      const patched = await eventsApi.patch(Number(event.id), {
        routeId: Number(route.id),
      });
      return { route, event: patched };
    },
    onSuccess: (res) => {
      notify(`Route linked: ${res.route.name}`);
      void qc.invalidateQueries({ queryKey: keys.routes });
      void qc.invalidateQueries({ queryKey: keys.event(Number(event.id)) });
      void qc.invalidateQueries({ queryKey: keys.events });
      setUploadOpen(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 200) {
        notify(
          `Identical route already exists; linked that one.`,
          "info"
        );
      } else {
        notify(e instanceof Error ? e.message : "Route upload failed", "error");
      }
    },
  });

  const routes = routesQ.data?.items ?? [];
  const currentRoute = routes.find(
    (r) => event.routeId !== null && Number(r.id) === Number(event.routeId)
  );
  const sharedWith = (eventsQ.data?.items ?? []).filter(
    (e) =>
      e.routeId !== null &&
      event.routeId !== null &&
      Number(e.routeId) === Number(event.routeId) &&
      Number(e.id) !== Number(event.id)
  );

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Route</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setUploadOpen(true)}
            >
              Upload
            </Button>
            {event.routeId !== null ? (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => patchMut.mutate(null)}
              >
                Unlink
              </Button>
            ) : null}
          </Stack>
        </Stack>
        {patchMut.error ? <ErrorAlert error={patchMut.error} /> : null}

        {event.routeId === null ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No route linked.
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Select
                displayEmpty
                size="small"
                value={chooseId === "" ? "" : String(chooseId)}
                onChange={(e) =>
                  setChooseId(e.target.value === "" ? "" : Number(e.target.value))
                }
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="">
                  <em>Choose existing route…</em>
                </MenuItem>
                {routes.map((r: Route) => (
                  <MenuItem key={String(r.id)} value={String(r.id)}>
                    {r.name}
                  </MenuItem>
                ))}
              </Select>
              <Button
                variant="outlined"
                disabled={chooseId === ""}
                onClick={() => chooseId !== "" && patchMut.mutate(Number(chooseId))}
              >
                Link
              </Button>
            </Stack>
          </Box>
        ) : (
          <Stack spacing={0.5} sx={{ mt: 2 }}>
            <Typography variant="subtitle1">
              {currentRoute?.name ?? `Route #${event.routeId}`}
            </Typography>
            {currentRoute ? (
              <>
                <Typography variant="body2">
                  <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
                    pointCount:
                  </Box>
                  {String(currentRoute.pointCount)}
                </Typography>
                <Typography variant="body2">
                  <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
                    createdAt:
                  </Box>
                  {formatMt(currentRoute.createdAt)}
                </Typography>
                <Typography variant="body2">
                  <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
                    uploadedBy:
                  </Box>
                  {currentRoute.uploadedBy}
                </Typography>
                {currentRoute.url ? (
                  <Typography variant="body2">
                    <Link
                      href={currentRoute.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      CDN link
                    </Link>
                  </Typography>
                ) : null}
              </>
            ) : null}
            {sharedWith.length > 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Shared with: {sharedWith.map((e) => e.name).join(", ")}
              </Typography>
            ) : null}
          </Stack>
        )}
      </CardContent>

      <RouteUploadDialog
        open={uploadOpen}
        submitting={uploadMut.isPending}
        error={uploadMut.error}
        onCancel={() => setUploadOpen(false)}
        onSubmit={(b) => uploadMut.mutate(b)}
      />
    </Card>
  );
}
