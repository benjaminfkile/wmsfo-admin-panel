import { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { beacons as beaconsApi } from "../../api/resources/beacons";
import { keys } from "../../queries/keys";
import { downloadText } from "../../lib/download";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import ErrorAlert from "../../components/ErrorAlert";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import type { BeaconLog } from "../../api/types";

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

  const columns: Column<BeaconLog>[] = [
    {
      key: "received",
      header: "Received",
      role: "title",
      render: (l) => formatMt(l.receivedAt),
    },
    {
      key: "appVersion",
      header: "App version",
      role: "line",
      label: "App version",
      render: (l) => l.appVersion ?? "none",
    },
    {
      key: "size",
      header: "Size",
      role: "line",
      label: "Size",
      align: "right",
      render: (l) =>
        typeof l.sizeBytes === "number"
          ? `${l.sizeBytes} B`
          : String(l.sizeBytes),
    },
  ];

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Logs</Typography>
      {logsQ.error ? <ErrorAlert error={logsQ.error} /> : null}
      <ResponsiveTable<BeaconLog>
        rows={sorted}
        columns={columns}
        rowKey={(l) => String(l.id)}
        rowTestId={(l) => `beacon-log-row-${l.id}`}
        emptyText="No logs uploaded."
        actions={(l) => (
          <Button
            size="small"
            onClick={() => openLogMut.mutate(Number(l.id))}
            disabled={openLogMut.isPending}
          >
            View
          </Button>
        )}
      />

      {openLogId !== null ? (
        <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
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
              maxWidth: "100%",
              overflow: "auto",
              backgroundColor: "background.default",
              fontFamily: "Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
              whiteSpace: "pre",
            }}
          >
            {logText}
          </Box>
        </Paper>
      ) : null}
    </Stack>
  );
}
