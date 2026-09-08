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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  events as eventsApi,
  type LocationsQuery,
} from "../../api/resources/events";
import { beacons as beaconsApi } from "../../api/resources/beacons";
import { keys } from "../../queries/keys";
import { formatMt } from "../../lib/time";
import { downloadBlob } from "../../lib/download";
import { useNotify } from "../../hooks/useNotify";
import type { Event } from "../../api/types";

interface Props {
  event: Event;
}

export default function LocationsSection({ event }: Props) {
  const notify = useNotify();
  const [beaconId, setBeaconId] = useState<number | "">("");
  const [publishedOnly, setPublishedOnly] = useState(false);

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

  const items = listQ.data?.items ?? [];
  const beacons = beaconsQ.data?.items ?? [];

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Locations</Typography>
          <Button
            variant="outlined"
            onClick={() => csvMut.mutate()}
            disabled={csvMut.isPending}
          >
            Download CSV
          </Button>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ my: 2 }} alignItems="center">
          <Select
            displayEmpty
            size="small"
            value={beaconId === "" ? "" : String(beaconId)}
            onChange={(e) =>
              setBeaconId(e.target.value === "" ? "" : Number(e.target.value))
            }
            sx={{ minWidth: 200 }}
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
          <Box sx={{ maxHeight: 400, overflow: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>seq</TableCell>
                  <TableCell>beaconId</TableCell>
                  <TableCell>published</TableCell>
                  <TableCell>recordedAt</TableCell>
                  <TableCell>lat</TableCell>
                  <TableCell>lng</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No locations yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={String(row.seq)}>
                      <TableCell>{String(row.seq)}</TableCell>
                      <TableCell>{String(row.beaconId)}</TableCell>
                      <TableCell>{row.published ? "yes" : "no"}</TableCell>
                      <TableCell>{formatMt(row.recordedAt)}</TableCell>
                      <TableCell>{String(row.lat)}</TableCell>
                      <TableCell>{String(row.lng)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
