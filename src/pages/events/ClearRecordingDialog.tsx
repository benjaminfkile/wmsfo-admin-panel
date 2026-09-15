import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import AppDialog from "../../components/AppDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { events as eventsApi } from "../../api/resources/events";
import type { Beacon } from "../../api/types";

interface Props {
  open: boolean;
  eventId: number;
  eventName: string;
  beacons: Beacon[];
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: (opts: { beaconId: number | null }) => void;
}

type Row = { id: number | null; name: string; count: number };

// Clear a recording (contracts 4.5 / admin.md 6.3). The impact preview
// carries one `locations` group per beacon (with the beacon's name),
// and while the event is live the response's `blocked` sentence sits in
// place of every action. Choose "All beacons" or one beacon from the
// preview.
export default function ClearRecordingDialog({
  open,
  eventId,
  eventName,
  beacons,
  disabled,
  onCancel,
  onConfirm,
}: Props) {
  const impactQ = useQuery({
    queryKey: ["impact", "event-locations", eventId],
    queryFn: () => eventsApi.locationsImpact(eventId),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const [beaconId, setBeaconId] = useState<number | "">("");
  useEffect(() => {
    if (open) setBeaconId("");
  }, [open, eventId]);

  const data = impactQ.data;
  const loaded = !!data;
  const blocked = data?.blocked ?? null;

  const rows: Row[] = useMemo(() => {
    const groups = (data?.deletes ?? []).filter(
      (g) => g.entity === "locations" || g.entity === "location"
    );
    const out: Row[] = [];
    for (const g of groups) {
      const name = g.names[0] ?? "beacon";
      const beacon = beacons.find((b) => (b.name ?? "") === name) ?? null;
      out.push({
        id: beacon ? Number(beacon.id) : null,
        name,
        count: Number(g.count ?? 0),
      });
    }
    return out;
  }, [data, beacons]);

  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);

  const confirmDisabled =
    !loaded || !!blocked || !!disabled || !!impactQ.error;

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{`Clear recording for ${eventName}?`}</DialogTitle>
      <DialogContent>
        {impactQ.isLoading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : impactQ.error ? (
          <ErrorAlert error={impactQ.error} />
        ) : blocked ? (
          <Alert severity="warning">{blocked}</Alert>
        ) : (
          <Stack spacing={2}>
            {rows.length === 0 ? (
              <Typography variant="body2">
                Nothing to clear: this event has no location rows.
              </Typography>
            ) : (
              <>
                <Typography variant="body2">
                  {totalCount.toLocaleString("en-US")} location
                  {totalCount === 1 ? "" : "s"} will be deleted.
                </Typography>
                <Box>
                  <Typography variant="subtitle2">By beacon</Typography>
                  <Stack component="ul" spacing={0.5} sx={{ pl: 3, my: 1 }}>
                    {rows.map((r, i) => (
                      <li key={i}>
                        <Typography variant="body2">
                          {r.name}: {r.count.toLocaleString("en-US")}
                        </Typography>
                      </li>
                    ))}
                  </Stack>
                </Box>
                <TextField
                  select
                  label="Beacon"
                  value={beaconId === "" ? "" : String(beaconId)}
                  onChange={(e) =>
                    setBeaconId(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  fullWidth
                  helperText="Choose a beacon to clear only its rows, or leave as 'All beacons'."
                >
                  <MenuItem value="">All beacons</MenuItem>
                  {rows
                    .filter((r) => r.id !== null)
                    .map((r) => (
                      <MenuItem key={r.id!} value={String(r.id)}>
                        {r.name}
                      </MenuItem>
                    ))}
                </TextField>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{blocked ? "Close" : "Cancel"}</Button>
        {blocked ? null : (
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              onConfirm({
                beaconId: typeof beaconId === "number" ? beaconId : null,
              })
            }
            disabled={confirmDisabled || rows.length === 0}
          >
            Clear recording
          </Button>
        )}
      </DialogActions>
    </AppDialog>
  );
}
