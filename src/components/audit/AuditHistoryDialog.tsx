import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useInfiniteQuery } from "@tanstack/react-query";
import { audit as auditApi } from "../../api/resources/audit";
import { keys } from "../../queries/keys";
import AppDialog from "../AppDialog";
import ErrorAlert from "../ErrorAlert";
import { ThemedJsonView } from "../ThemedJsonView";
import { formatMt } from "../../lib/time";
import type { AuditEntry, Page } from "../../api/types";
import { formatAction, formatActor, summariseEntry } from "./auditFormat";

interface Props {
  open: boolean;
  entity: string;
  entityId: string;
  title: string;
  onClose: () => void;
}

export default function AuditHistoryDialog({
  open,
  entity,
  entityId,
  title,
  onClose,
}: Props) {
  const q = useInfiniteQuery<Page<AuditEntry>, Error>({
    enabled: open,
    queryKey: keys.audit({ entity, entityId }),
    queryFn: ({ pageParam }) =>
      auditApi.list({
        entity,
        entityId,
        cursor: typeof pageParam === "string" ? pageParam : undefined,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entries = useMemo<AuditEntry[]>(
    () => (q.data?.pages ?? []).flatMap((p) => p.items ?? []),
    [q.data]
  );

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-label="Audit history"
    >
      <DialogTitle>Audit history - {title}</DialogTitle>
      <DialogContent>
        {q.error ? <ErrorAlert error={q.error} /> : null}
        {q.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : entries.length === 0 ? (
          <Alert severity="info">No changes recorded since the audit log began.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Time</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Changes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((e) => (
                  <EntryRow key={String(e.id)} entry={e} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {q.hasNextPage ? (
          <Box sx={{ mt: 2 }}>
            <Button
              onClick={() => q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
              size="small"
            >
              Load more
            </Button>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </AppDialog>
  );
}

function EntryRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow hover data-testid={`audit-entry-${entry.id}`}>
        <TableCell padding="none" sx={{ width: 40 }}>
          <IconButton
            size="small"
            onClick={() => setOpen((p) => !p)}
            aria-label={open ? "Hide raw JSON" : "Show raw JSON"}
          >
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>{formatMt(entry.at)}</TableCell>
        <TableCell>{formatActor(entry.actor)}</TableCell>
        <TableCell>{formatAction(entry.action)}</TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {summariseEntry(entry)}
          </Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ p: 0, borderBottom: open ? undefined : "none" }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="overline">Before</Typography>
                  {entry.before === null || entry.before === undefined ? (
                    <Typography variant="body2" color="text.secondary">
                      (none)
                    </Typography>
                  ) : (
                    <ThemedJsonView value={entry.before} />
                  )}
                </Box>
                <Box>
                  <Typography variant="overline">After</Typography>
                  {entry.after === null || entry.after === undefined ? (
                    <Typography variant="body2" color="text.secondary">
                      (none)
                    </Typography>
                  ) : (
                    <ThemedJsonView value={entry.after} />
                  )}
                </Box>
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
