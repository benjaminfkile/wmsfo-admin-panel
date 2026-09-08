import { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { beacons as beaconsApi } from "../../api/resources/beacons";
import { keys } from "../../queries/keys";
import { downloadText } from "../../lib/download";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import ErrorAlert from "../../components/ErrorAlert";

interface Props {
  beaconId: number;
}

// Log list + inline body viewer for admin-role beacons (admin.md 6.5).
export default function BeaconLogs({ beaconId }: Props) {
  const notify = useNotify();
  const [openLogId, setOpenLogId] = useState<number | null>(null);
  const [logText, setLogText] = useState("");

  const logsQ = useQuery({
    queryKey: keys.beaconLogs(beaconId),
    queryFn: () => beaconsApi.logs(beaconId),
    enabled: Number.isFinite(beaconId),
  });

  const openLogMut = useMutation({
    mutationFn: (logId: number) => beaconsApi.logText(beaconId, logId),
    onSuccess: (text, logId) => {
      setOpenLogId(logId);
      setLogText(text);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Failed to fetch log", "error"),
  });

  const sorted = [...(logsQ.data?.items ?? [])].sort((a, b) =>
    (a.receivedAt ?? "") < (b.receivedAt ?? "") ? 1 : -1
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Logs</Typography>
      {logsQ.error ? <ErrorAlert error={logsQ.error} /> : null}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Received</TableCell>
              <TableCell>App version</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">
                    No logs uploaded.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((l) => (
                <TableRow
                  key={String(l.id)}
                  hover
                  data-testid={`beacon-log-row-${l.id}`}
                >
                  <TableCell>{formatMt(l.receivedAt)}</TableCell>
                  <TableCell>{l.appVersion ?? "—"}</TableCell>
                  <TableCell align="right">
                    {typeof l.sizeBytes === "number"
                      ? `${l.sizeBytes} B`
                      : String(l.sizeBytes)}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => openLogMut.mutate(Number(l.id))}
                      disabled={openLogMut.isPending}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {openLogId !== null ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle2">Log #{openLogId}</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() =>
                  downloadText(
                    logText,
                    `beacon-${beaconId}-log-${openLogId}.txt`
                  )
                }
              >
                Download
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setOpenLogId(null);
                  setLogText("");
                }}
              >
                Close
              </Button>
            </Stack>
          </Stack>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              maxHeight: 480,
              overflow: "auto",
              backgroundColor: "background.default",
              fontFamily: "Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {logText}
          </Box>
        </Paper>
      ) : null}
    </Stack>
  );
}
