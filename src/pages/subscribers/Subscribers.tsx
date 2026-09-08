import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  subscribers as subscribersApi,
  type SubscriberStatus,
} from "../../api/resources/subscribers";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import { csvFromRecords } from "../../lib/csv";
import { downloadCsv } from "../../lib/download";
import { formatMt } from "../../lib/time";
import type { SubscriberAdmin } from "../../api/types";

type FilterValue = "all" | SubscriberStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "unsubscribed", label: "Unsubscribed" },
];

export default function Subscribers() {
  const qc = useQueryClient();
  const notify = useNotify();

  const [filter, setFilter] = useState<FilterValue>("all");
  const status: SubscriberStatus | undefined =
    filter === "all" ? undefined : filter;

  const summaryQ = useQuery({
    queryKey: keys.subscribersSummary,
    queryFn: () => subscribersApi.summary(),
  });

  const listQ = useInfiniteQuery({
    queryKey: keys.subscribers(status),
    queryFn: ({ pageParam }) =>
      subscribersApi.list({
        cursor: pageParam,
        limit: 50,
        status,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => subscribersApi.remove(id),
    onSuccess: () => {
      notify("Subscriber deleted");
      void qc.invalidateQueries({ queryKey: keys.subscribers(status) });
      void qc.invalidateQueries({ queryKey: keys.subscribersSummary });
      setConfirmDelete(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const [confirmDelete, setConfirmDelete] = useState<SubscriberAdmin | null>(
    null
  );

  const [exportState, setExportState] = useState<{
    running: boolean;
    count: number;
    error?: string;
  }>({ running: false, count: 0 });

  const exportCsv = async () => {
    setExportState({ running: true, count: 0 });
    try {
      const rows: SubscriberAdmin[] = [];
      let cursor: string | undefined = undefined;
      while (true) {
        const page = await subscribersApi.list({
          cursor,
          limit: 500,
          status,
        });
        rows.push(...page.items);
        setExportState({ running: true, count: rows.length });
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      const csv = csvFromRecords(
        [
          "id",
          "personId",
          "personEmail",
          "channel",
          "address",
          "verifiedAt",
          "unsubscribedAt",
          "createdAt",
        ],
        rows.map((r) => ({
          id: r.id ?? "",
          personId: r.personId ?? "",
          personEmail: r.personEmail ?? "",
          channel: r.channel ?? "",
          address: r.address ?? "",
          verifiedAt: r.verifiedAt ?? "",
          unsubscribedAt: r.unsubscribedAt ?? "",
          createdAt: r.createdAt ?? "",
        }))
      );
      const stamp = todayStamp();
      downloadCsv(csv, `subscribers-${filter}-${stamp}.csv`);
      setExportState({ running: false, count: rows.length });
      notify(`Exported ${rows.length} rows`);
    } catch (e) {
      setExportState({
        running: false,
        count: 0,
        error: e instanceof Error ? e.message : "Export failed",
      });
      notify("Export failed", "error");
    }
  };

  const rows: SubscriberAdmin[] = useMemo(
    () => (listQ.data?.pages ?? []).flatMap((p) => p.items ?? []),
    [listQ.data]
  );

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">Subscribers</Typography>
        <Button
          variant="contained"
          onClick={() => void exportCsv()}
          disabled={exportState.running}
          data-testid="subscribers-export-csv"
        >
          {exportState.running
            ? `Exporting: ${exportState.count} rows`
            : "Export CSV"}
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Chip label={`Verified: ${summaryQ.data?.verified ?? "—"}`} />
        <Chip label={`Pending: ${summaryQ.data?.pending ?? "—"}`} />
        <Chip label={`Unsubscribed: ${summaryQ.data?.unsubscribed ?? "—"}`} />
        <TextField
          select
          label="Filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterValue)}
          size="small"
          sx={{ minWidth: 180 }}
        >
          {FILTERS.map((f) => (
            <MenuItem key={f.value} value={f.value}>
              {f.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {listQ.error ? <ErrorAlert error={listQ.error} /> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Person email</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Verified at</TableCell>
              <TableCell>Unsubscribed at</TableCell>
              <TableCell>Created at</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    No subscribers.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow
                  key={String(s.id)}
                  data-testid={`subscriber-row-${s.id}`}
                >
                  <TableCell>{s.personEmail ?? "—"}</TableCell>
                  <TableCell>{s.address ?? "—"}</TableCell>
                  <TableCell>{s.channel ?? "—"}</TableCell>
                  <TableCell>{formatMt(s.verifiedAt) || "—"}</TableCell>
                  <TableCell>{formatMt(s.unsubscribedAt) || "—"}</TableCell>
                  <TableCell>{formatMt(s.createdAt) || "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Delete"
                      onClick={() => setConfirmDelete(s)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {listQ.hasNextPage ? (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Button
            onClick={() => void listQ.fetchNextPage()}
            disabled={listQ.isFetchingNextPage}
          >
            {listQ.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </Box>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete subscriber?"
        body={
          confirmDelete
            ? `Delete ${confirmDelete.personEmail ?? "this subscriber"}? The person may subscribe again.`
            : ""
        }
        confirmLabel="Delete"
        danger
        disabled={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() =>
          confirmDelete && deleteMut.mutate(Number(confirmDelete.id))
        }
      />
    </>
  );
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
