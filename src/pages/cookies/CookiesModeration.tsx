import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import { cookies as cookiesApi } from "../../api/resources/cookies";
import { cookieTypes as cookieTypesApi } from "../../api/resources/cookieTypes";
import { keys } from "../../queries/keys";
import CommentBox from "../../components/CommentBox";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import type { CookieAdmin } from "../../api/types";

export default function CookiesModeration() {
  const qc = useQueryClient();
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();

  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });
  const cookieTypesQ = useQuery({
    queryKey: keys.cookieTypes,
    queryFn: () => cookieTypesApi.list(),
  });

  const events = useMemo(() => eventsQ.data?.items ?? [], [eventsQ.data]);
  const currentEvent = useMemo(
    () => events.find((e) => e.isCurrent) ?? null,
    [events]
  );

  // Preselect: ?eventId=; else the current event's id; else the first event.
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  useEffect(() => {
    if (selectedEventId !== null) return;
    const q = searchParams.get("eventId");
    if (q) {
      const n = Number(q);
      if (Number.isFinite(n)) {
        setSelectedEventId(n);
        return;
      }
    }
    if (currentEvent?.id !== undefined && currentEvent.id !== null) {
      setSelectedEventId(Number(currentEvent.id));
    } else if (events.length > 0 && events[0]?.id !== undefined) {
      setSelectedEventId(Number(events[0].id));
    }
  }, [searchParams, currentEvent, events, selectedEventId]);

  const [includeHidden, setIncludeHidden] = useState(true);

  const cookiesQ = useInfiniteQuery({
    queryKey: keys.eventCookies(selectedEventId ?? -1, includeHidden),
    queryFn: ({ pageParam }) =>
      eventsApi.cookies(selectedEventId!, {
        cursor: pageParam,
        includeHidden,
        limit: 50,
      }),
    enabled: selectedEventId !== null && Number.isFinite(selectedEventId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const hideMut = useMutation({
    mutationFn: (id: number) => cookiesApi.hide(id),
    onSuccess: (row) => {
      notify("Cookie hidden");
      applyRowUpdate(row);
    },
  });
  const unhideMut = useMutation({
    mutationFn: (id: number) => cookiesApi.unhide(id),
    onSuccess: (row) => {
      notify("Cookie unhidden");
      applyRowUpdate(row);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => cookiesApi.remove(id),
    onSuccess: () => {
      notify("Cookie deleted");
      void qc.invalidateQueries({
        queryKey: keys.eventCookies(selectedEventId ?? -1, includeHidden),
      });
      setConfirmDelete(null);
    },
  });

  const applyRowUpdate = (row: CookieAdmin) => {
    if (selectedEventId === null) return;
    const qk = keys.eventCookies(selectedEventId, includeHidden);
    const data = qc.getQueryData<{
      pages: { items: CookieAdmin[]; nextCursor: string | null }[];
      pageParams: unknown[];
    }>(qk);
    if (!data) return;
    const nextPages = data.pages.map((p) => ({
      ...p,
      items: p.items.map((c) => (String(c.id) === String(row.id) ? row : c)),
    }));
    qc.setQueryData(qk, { ...data, pages: nextPages });
  };

  const [confirmDelete, setConfirmDelete] = useState<CookieAdmin | null>(null);

  const cookieTypeNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of cookieTypesQ.data?.items ?? []) {
      if (t.id !== undefined && t.id !== null) m.set(String(t.id), t.name ?? String(t.id));
    }
    return m;
  }, [cookieTypesQ.data]);

  const rows: CookieAdmin[] = (cookiesQ.data?.pages ?? []).flatMap(
    (p) => p.items ?? []
  );

  return (
    <>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Cookies
      </Typography>
      <CommentBox>
        Hidden cookies leave the public tally and still count toward the
        person's limit; deleted cookies do neither. Moderation is allowed in
        any event status.
      </CommentBox>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          select
          label="Event"
          size="small"
          value={selectedEventId ?? ""}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSelectedEventId(v);
            setSearchParams({ eventId: String(v) });
          }}
          sx={{ minWidth: 240 }}
        >
          {events.length === 0 ? (
            <MenuItem value="">No events</MenuItem>
          ) : null}
          {events.map((e) => (
            <MenuItem key={String(e.id)} value={String(e.id)}>
              {e.name} ({String(e.year)})
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          label="Include hidden"
          control={
            <Switch
              checked={includeHidden}
              onChange={(_, v) => setIncludeHidden(v)}
            />
          }
        />
      </Stack>

      {cookiesQ.error ? <ErrorAlert error={cookiesQ.error} /> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Left at</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Person</TableCell>
              <TableCell>Note</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No cookies for this event.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const hidden = c.hiddenAt !== null && c.hiddenAt !== undefined;
                const typeName =
                  cookieTypeNames.get(String(c.cookieTypeId)) ??
                  String(c.cookieTypeId);
                return (
                  <TableRow
                    key={String(c.id)}
                    data-testid={`cookie-row-${c.id}`}
                    sx={hidden ? { opacity: 0.6 } : undefined}
                  >
                    <TableCell>{formatMt(c.leftAt) || "none"}</TableCell>
                    <TableCell>{typeName}</TableCell>
                    <TableCell>{c.personEmail ?? "none"}</TableCell>
                    <TableCell sx={{ whiteSpace: "pre-wrap" }}>
                      {c.note ?? ""}
                    </TableCell>
                    <TableCell>
                      {hidden
                        ? `hidden by ${c.hiddenBy ?? "?"} at ${formatMt(
                            c.hiddenAt ?? null
                          )}`
                        : "visible"}
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                      >
                        {hidden ? (
                          <Button
                            size="small"
                            onClick={() => unhideMut.mutate(Number(c.id))}
                          >
                            Unhide
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            onClick={() => hideMut.mutate(Number(c.id))}
                          >
                            Hide
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Delete"
                          onClick={() => setConfirmDelete(c)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {cookiesQ.hasNextPage ? (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Button
            onClick={() => void cookiesQ.fetchNextPage()}
            disabled={cookiesQ.isFetchingNextPage}
          >
            {cookiesQ.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </Box>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete cookie?"
        body={
          confirmDelete
            ? `Delete this cookie by ${confirmDelete.personEmail ?? "unknown"}? This cannot be undone.`
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
