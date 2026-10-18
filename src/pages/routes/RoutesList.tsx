import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  DialogActions,
  DialogContent,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import { routes as routesApi } from "../../api/resources/routes";
import type { RouteUploadBody } from "../../api/resources/routes";
import { keys } from "../../queries/keys";
import AppDialog from "../../components/AppDialog";
import CommentBox from "../../components/CommentBox";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { formatStamp } from "../../lib/time";
import { useNotify } from "../../hooks/useNotify";
import RouteUploadDialog from "../events/RouteUploadDialog";
import type { Event, Route } from "../../api/types";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";

export default function RoutesList() {
  const qc = useQueryClient();
  const notify = useNotify();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fromEventOpen, setFromEventOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Route | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    route: Route;
  } | null>(null);

  const routesQ = useQuery({
    queryKey: keys.routes,
    queryFn: () => routesApi.list(),
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const uploadMut = useMutation({
    mutationFn: (b: RouteUploadBody) => routesApi.create(b),
    onSuccess: () => {
      notify("Route uploaded");
      void qc.invalidateQueries({ queryKey: keys.routes });
      setUploadOpen(false);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Upload failed", "error"),
  });

  const fromEventMut = useMutation({
    mutationFn: ({ eventId, name }: { eventId: number; name: string }) =>
      routesApi.fromEvent(eventId, { name }),
    onSuccess: () => {
      notify("Route built from event");
      void qc.invalidateQueries({ queryKey: keys.routes });
      setFromEventOpen(false);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Build failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => routesApi.remove(id),
    onSuccess: () => {
      notify("Route deleted");
      void qc.invalidateQueries({ queryKey: keys.routes });
      setConfirmDelete(null);
    },
  });

  const routes = [...(routesQ.data?.items ?? [])].sort((a, b) =>
    (a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1
  );
  const events = eventsQ.data?.items ?? [];

  const columns: Column<Route>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (r) => r.name,
    },
    {
      key: "points",
      header: "Points",
      align: "right",
      role: "line",
      render: (r) => String(r.pointCount),
    },
    {
      key: "created",
      header: "Created",
      role: "line",
      render: (r) => formatStamp(r.createdAt),
    },
    {
      key: "uploadedBy",
      header: "Uploaded by",
      role: "line",
      render: (r) => r.uploadedBy ?? "none",
    },
    {
      key: "link",
      header: "Link",
      label: "CDN",
      role: "line",
      render: (r) =>
        r.url ? (
          <Link
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ wordBreak: "break-all" }}
          >
            CDN
          </Link>
        ) : (
          "none"
        ),
    },
    {
      key: "site",
      header: "Site route",
      role: "chip",
      render: (r) => <SiteRouteChips route={r} />,
      renderCompact: (r) =>
        r.isSiteRoute || r.isDraftRoute ? <SiteRouteChips route={r} /> : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Flight recordings"
        help="routes"
        actions={
          <>
            <Button variant="outlined" onClick={() => setFromEventOpen(true)}>
              Build from event
            </Button>
            <Button variant="contained" onClick={() => setUploadOpen(true)}>
              Upload recording
            </Button>
          </>
        }
      />
      <CommentBox>
        Recordings of past flights. The site route is chosen in{" "}
        <Link component={RouterLink} to="/site-settings">
          Site settings
        </Link>
        : the route map, the tracker&apos;s flight history, and every poster
        draw it once it is published. A recording the site settings name
        cannot be deleted.
      </CommentBox>

      {routesQ.error ? (
        <ErrorAlert error={routesQ.error} />
      ) : (
        <ResponsiveTable<Route>
          rows={routes}
          columns={columns}
          rowKey={(r) => String(r.id)}
          rowTestId={(r) => `route-row-${r.id}`}
          emptyText="No routes yet."
          actions={(r) => (
            <IconButton
              size="small"
              aria-label={`Actions for ${r.name ?? "route"}`}
              onClick={(ev) =>
                setMenuAnchor({ el: ev.currentTarget, route: r })
              }
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
          audit={(r) => ({
            entity: "route",
            entityId: r.id ?? "",
            name: r.name ?? "route",
            audit: r.audit,
          })}
        />
      )}

      {menuAnchor ? (
        <Menu
          open
          anchorEl={menuAnchor.el}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setConfirmDelete(menuAnchor.route);
              setMenuAnchor(null);
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      ) : null}

      <RouteUploadDialog
        open={uploadOpen}
        submitting={uploadMut.isPending}
        error={uploadMut.error}
        onCancel={() => setUploadOpen(false)}
        onSubmit={(b) => uploadMut.mutate(b)}
      />

      <BuildFromEventDialog
        open={fromEventOpen}
        events={events}
        submitting={fromEventMut.isPending}
        error={fromEventMut.error}
        onCancel={() => setFromEventOpen(false)}
        onSubmit={(eventId, name) => fromEventMut.mutate({ eventId, name })}
      />

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="routes"
          id={Number(confirmDelete.id)}
          name={confirmDelete.name ?? "recording"}
          disabled={deleteMut.isPending}
          error={deleteMut.error}
          onCancel={() => {
            setConfirmDelete(null);
            deleteMut.reset();
          }}
          onConfirm={() => deleteMut.mutate(Number(confirmDelete.id))}
        />
      ) : null}
    </>
  );
}

// The Routes page's site route chips: "Site route" on the recording the
// newest published site settings name (`isSiteRoute`), "Draft" on the one
// the site settings draft names (`isDraftRoute`), both when they agree,
// and "none" when neither does.
function SiteRouteChips({ route }: { route: Route }) {
  if (!route.isSiteRoute && !route.isDraftRoute) {
    return (
      <Box component="span" sx={{ color: "text.secondary" }}>
        none
      </Box>
    );
  }
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {route.isSiteRoute ? (
        <Chip size="small" color="primary" label="Site route" data-testid={`route-site-${route.id}`} />
      ) : null}
      {route.isDraftRoute ? (
        <Chip size="small" variant="outlined" label="Draft" data-testid={`route-draft-${route.id}`} />
      ) : null}
    </Stack>
  );
}

interface BuildProps {
  open: boolean;
  events: Event[];
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (eventId: number, name: string) => void;
}

function BuildFromEventDialog({
  open,
  events,
  submitting,
  error,
  onCancel,
  onSubmit,
}: BuildProps) {
  const [eventId, setEventId] = useState<number | "">("");
  const [name, setName] = useState("");
  const eligible = events.filter((e) => Number(e.statusId) === 4);
  const selected = eligible.find((e) => Number(e.id) === Number(eventId));

  return (
    <AppDialog
      open={open}
      onClose={() => {
        onCancel();
        setEventId("");
        setName("");
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitleWithHelp help="routes.build-from-event">
        Build route from event
      </DialogTitleWithHelp>
      <DialogContent>
        <Card variant="outlined" sx={{ mt: 1, mb: 2 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Build a route from an ended event's published locations. The new
              route is created with a fresh id and can be linked to any event
              from its page.
            </Typography>
          </CardContent>
        </Card>
        {error ? <ErrorAlert error={error} /> : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Select
            displayEmpty
            value={eventId === "" ? "" : String(eventId)}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Number(e.target.value);
              setEventId(v);
              const chosen = eligible.find((x) => Number(x.id) === v);
              if (chosen) setName(`${chosen.name} route`);
            }}
          >
            <MenuItem value="">
              <em>Select an ended event…</em>
            </MenuItem>
            {eligible.map((e) => (
              <MenuItem key={String(e.id)} value={String(e.id)}>
                {e.name} ({String(e.year)})
              </MenuItem>
            ))}
          </Select>
          {eligible.length === 0 ? (
            <Alert severity="info">
              No ended events available to build a route from.
            </Alert>
          ) : null}
          <TextField
            label="Route name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          {selected ? (
            <Typography variant="body2" color="text.secondary">
              Building from {selected.name}
              {selected.endedAt ? ` (ended ${formatStamp(selected.endedAt)})` : ""}
            </Typography>
          ) : null}
          <Box />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onCancel();
            setEventId("");
            setName("");
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() =>
            eventId !== "" && onSubmit(Number(eventId), name.trim())
          }
          disabled={
            eventId === "" || submitting || name.trim().length < 1
          }
        >
          Build
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
