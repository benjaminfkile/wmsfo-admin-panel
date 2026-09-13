import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
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
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { audit as auditApi, AUDIT_ACTIONS } from "../../api/resources/audit";
import { keys } from "../../queries/keys";
import ErrorAlert from "../../components/ErrorAlert";
import { ThemedJsonView } from "../../components/ThemedJsonView";
import { formatMt } from "../../lib/time";
import {
  formatAction,
  formatActor,
  summariseEntry,
} from "../../components/audit/auditFormat";
import type { AuditEntry, Page } from "../../api/types";

type Filters = {
  entity: string;
  action: string;
  actor: string;
  entityId: string;
};

const EMPTY: Filters = { entity: "", action: "", actor: "", entityId: "" };

// Where every audited entity's row lives, so an entry with a matching
// entity gets a link back to its detail page.
const ROUTE_FOR_ENTITY: Record<string, (id: string) => string> = {
  event: (id) => `/events/${id}`,
  events: (id) => `/events/${id}`,
  beacon: (id) => `/beacons/${id}`,
  beacons: (id) => `/beacons/${id}`,
  sponsor: (id) => `/sponsors/${id}`,
  sponsors: (id) => `/sponsors/${id}`,
  page: (id) => `/pages/${id}`,
  pages: (id) => `/pages/${id}`,
  qr_code: (id) => `/qr-codes/${id}`,
};

export default function AuditPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const applied = filters;

  const entitiesQ = useQuery({
    queryKey: keys.auditEntities,
    queryFn: () => auditApi.entities(),
  });

  const listQ = useInfiniteQuery<Page<AuditEntry>, Error>({
    queryKey: keys.audit({
      entity: applied.entity || undefined,
      entityId: applied.entityId || undefined,
      action: applied.action || undefined,
      actor: applied.actor || undefined,
    }),
    queryFn: ({ pageParam }) =>
      auditApi.list({
        entity: applied.entity || undefined,
        entityId: applied.entityId || undefined,
        action: applied.action || undefined,
        actor: applied.actor || undefined,
        cursor: typeof pageParam === "string" ? pageParam : undefined,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entries = useMemo<AuditEntry[]>(
    () => (listQ.data?.pages ?? []).flatMap((p) => p.items ?? []),
    [listQ.data]
  );

  const entityOptions = entitiesQ.data?.items ?? [];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Audit
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label="Entity"
            value={filters.entity}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            {entityOptions.map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Action"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            {AUDIT_ACTIONS.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Actor"
            value={filters.actor}
            onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
            sx={{ minWidth: 200 }}
          />
          <Chip
            label="Deletes"
            color={filters.action === "delete" ? "primary" : "default"}
            onClick={() =>
              setFilters((p) =>
                p.action === "delete" ? { ...p, action: "" } : { ...p, action: "delete" }
              )
            }
            variant={filters.action === "delete" ? "filled" : "outlined"}
          />
        </Stack>
      </Paper>

      {listQ.error ? <ErrorAlert error={listQ.error} /> : null}
      {entries.length === 0 && !listQ.isLoading ? (
        <Alert severity="info">No audit entries match those filters.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Time</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Changes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <AuditRow key={String(e.id)} entry={e} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {listQ.hasNextPage ? (
        <Box sx={{ mt: 2 }}>
          <Button
            onClick={() => listQ.fetchNextPage()}
            disabled={listQ.isFetchingNextPage}
            size="small"
          >
            Load more
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const link = entry.entity
    ? ROUTE_FOR_ENTITY[entry.entity]?.(String(entry.entityId ?? ""))
    : undefined;
  const isDeleted = entry.action === "delete";
  const entityLabel = `${entry.entity ?? ""} #${entry.entityId ?? ""}`;
  return (
    <>
      <TableRow hover data-testid={`audit-page-row-${entry.id}`}>
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
          {link && !isDeleted ? (
            <a href={link}>{entityLabel}</a>
          ) : (
            <span>{entityLabel}</span>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {summariseEntry(entry)}
          </Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? undefined : "none" }}>
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
