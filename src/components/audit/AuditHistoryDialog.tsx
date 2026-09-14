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
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useInfiniteQuery } from "@tanstack/react-query";
import { audit as auditApi } from "../../api/resources/audit";
import { keys } from "../../queries/keys";
import AppDialog from "../AppDialog";
import ErrorAlert from "../ErrorAlert";
import ResponsiveTable, { type Column } from "../list/ResponsiveTable";
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: "time",
      header: "Time",
      role: "title",
      render: (e) => formatMt(e.at),
    },
    {
      key: "actorAction",
      header: "Actor and action",
      role: "subtitle",
      compactOnly: true,
      render: (e) => `${formatActor(e.actor)} - ${formatAction(e.action)}`,
    },
    {
      key: "actor",
      header: "Actor",
      render: (e) => formatActor(e.actor),
    },
    {
      key: "action",
      header: "Action",
      render: (e) => formatAction(e.action),
    },
    {
      key: "changes",
      header: "Changes",
      role: "line",
      render: (e) => (
        <Typography
          variant="body2"
          component="span"
          sx={{ whiteSpace: "pre-wrap" }}
        >
          {summariseEntry(e)}
        </Typography>
      ),
    },
  ];

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
          <ResponsiveTable<AuditEntry>
            rows={entries}
            columns={columns}
            rowKey={(e) => String(e.id)}
            rowTestId={(e) => `audit-entry-${e.id}`}
            emptyText="No changes recorded since the audit log began."
            actions={(e) => {
              const id = String(e.id);
              const open = expanded.has(id);
              return (
                <IconButton
                  size="small"
                  onClick={() => toggle(id)}
                  aria-label={open ? "Hide raw JSON" : "Show raw JSON"}
                >
                  {open ? (
                    <ExpandLessIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </IconButton>
              );
            }}
            expandedContent={(e) => {
              const id = String(e.id);
              const open = expanded.has(id);
              return (
                <Collapse in={open} unmountOnExit>
                  <Box sx={{ p: 2 }}>
                    <BeforeAfter entry={e} />
                  </Box>
                </Collapse>
              );
            }}
          />
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

function BeforeAfter({ entry }: { entry: AuditEntry }) {
  return (
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
  );
}
