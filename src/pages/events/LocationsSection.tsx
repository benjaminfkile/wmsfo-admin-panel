import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  events as eventsApi,
  type LocationsQuery,
} from "../../api/resources/events";
import { beacons as beaconsApi } from "../../api/resources/beacons";
import { keys } from "../../queries/keys";
import { formatStamp } from "../../lib/time";
import { downloadBlob } from "../../lib/download";
import { useNotify } from "../../hooks/useNotify";
import type { Event, LocationRow } from "../../api/types";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import ClearRecordingDialog from "./ClearRecordingDialog";
import CardTitle from "../../help/CardTitle";

interface Props {
  event: Event;
}

// A measured value with its source ("beacon", "derived") as a muted
// word after it; a null value is the placeholder with no source word.
function withSource(value: string | null, source: string | null | undefined) {
  if (value === null) {
    return (
      <Box component="span" sx={{ color: "text.secondary" }}>
        none
      </Box>
    );
  }
  return (
    <>
      {value}
      {source ? (
        <Box component="span" sx={{ color: "text.secondary", ml: 0.5 }}>
          {source}
        </Box>
      ) : null}
    </>
  );
}

function present(v: number | string | null | undefined): v is number | string {
  return v !== null && v !== undefined && v !== "";
}

function formatSpeed(row: LocationRow) {
  return withSource(
    present(row.speedMps) ? `${Number(row.speedMps).toFixed(1)} m/s` : null,
    row.speedSource
  );
}

function formatHeading(row: LocationRow) {
  return withSource(
    present(row.headingDeg) ? `${Math.round(Number(row.headingDeg))}°` : null,
    row.headingSource
  );
}

const COLUMNS: Column<LocationRow>[] = [
  {
    key: "seq",
    header: "seq",
    role: "title",
    render: (r) => String(r.seq),
    renderCompact: (r) => `seq ${String(r.seq)}`,
  },
  {
    key: "beaconId",
    header: "beaconId",
    role: "line",
    render: (r) => String(r.beaconId),
  },
  {
    key: "published",
    header: "published",
    role: "line",
    render: (r) => (r.published ? "yes" : "no"),
  },
  {
    key: "recordedAt",
    header: "recordedAt",
    role: "subtitle",
    render: (r) => formatStamp(r.recordedAt),
  },
  { key: "lat", header: "lat", role: "line", render: (r) => String(r.lat) },
  { key: "lng", header: "lng", role: "line", render: (r) => String(r.lng) },
  { key: "speed", header: "Speed", role: "line", render: formatSpeed },
  { key: "heading", header: "Heading", role: "line", render: formatHeading },
];

export default function LocationsSection({ event }: Props) {
  const notify = useNotify();
  const qc = useQueryClient();
  const [beaconId, setBeaconId] = useState<number | "">("");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const beaconsQ = useQuery({
    queryKey: keys.beacons,
    queryFn: () => beaconsApi.list(),
  });

  const q: LocationsQuery = {
    limit: 100,
    ...(beaconId === "" ? {} : { beaconId: Number(beaconId) }),
    ...(publishedOnly ? { publishedOnly: true } : {}),
  };

  const listQ = useQuery({
    queryKey: keys.eventLocations(Number(event.id), q),
    queryFn: () => eventsApi.locations(Number(event.id), q),
  });

  const csvMut = useMutation({
    mutationFn: () =>
      eventsApi.locationsCsv(Number(event.id), {
        ...(beaconId === "" ? {} : { beaconId: Number(beaconId) }),
        ...(publishedOnly ? { publishedOnly: true } : {}),
      }),
    onSuccess: (blob) => {
      downloadBlob(blob, `locations-${event.year}.csv`);
      notify("Location CSV downloaded");
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Download failed", "error"),
  });

  const clearMut = useMutation({
    mutationFn: (bid: number | null) =>
      eventsApi.clearLocations(
        Number(event.id),
        bid !== null ? bid : undefined
      ),
    onSuccess: () => {
      notify("Recording cleared");
      setClearOpen(false);
      void qc.invalidateQueries({ queryKey: keys.event(Number(event.id)) });
      void qc.invalidateQueries({
        queryKey: ["events", Number(event.id), "locations"],
      });
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Clear failed", "error"),
  });

  const items = listQ.data?.items ?? [];
  const beacons = beaconsQ.data?.items ?? [];

  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1}
        >
          <CardTitle help="events.detail.locations">Locations</CardTitle>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              variant="outlined"
              onClick={() => csvMut.mutate()}
              disabled={csvMut.isPending}
            >
              Download CSV
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setClearOpen(true)}
              data-testid="clear-recording"
            >
              Clear recording
            </Button>
          </Stack>
        </Stack>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ my: 2 }}
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <Select
            displayEmpty
            size="small"
            value={beaconId === "" ? "" : String(beaconId)}
            onChange={(e) =>
              setBeaconId(e.target.value === "" ? "" : Number(e.target.value))
            }
            sx={{ minWidth: { xs: "100%", md: 200 } }}
          >
            <MenuItem value="">Any beacon</MenuItem>
            {beacons.map((b) => (
              <MenuItem key={String(b.id)} value={String(b.id)}>
                {b.name}
              </MenuItem>
            ))}
          </Select>
          <FormControlLabel
            control={
              <Switch
                checked={publishedOnly}
                onChange={(e) => setPublishedOnly(e.target.checked)}
              />
            }
            label="Published only"
          />
        </Stack>
        {listQ.error ? (
          <Typography color="error" variant="body2">
            {(listQ.error as Error).message}
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 400, overflow: "auto", maxWidth: "100%" }}>
            <ResponsiveTable<LocationRow>
              rows={items}
              columns={COLUMNS}
              rowKey={(r) => String(r.seq)}
              rowTestId={(r) => `location-${String(r.seq)}`}
              emptyText="No locations yet."
              stickyHeader
            />
          </Box>
        )}
      </CardContent>
      {clearOpen ? (
        <ClearRecordingDialog
          open={clearOpen}
          eventId={Number(event.id)}
          eventName={event.name ?? "event"}
          beacons={beacons}
          disabled={clearMut.isPending}
          onCancel={() => setClearOpen(false)}
          onConfirm={({ beaconId: bid }) => clearMut.mutate(bid)}
        />
      ) : null}
    </Card>
  );
}
