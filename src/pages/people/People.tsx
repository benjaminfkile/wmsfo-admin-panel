import { useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { people as peopleApi } from "../../api/resources/people";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import type { Person } from "../../api/types";

type PersonWithCount = Person & { cookieCount: number };

export default function People() {
  const qc = useQueryClient();
  const notify = useNotify();

  const listQ = useInfiniteQuery({
    queryKey: keys.people,
    queryFn: ({ pageParam }) =>
      peopleApi.list({ cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => peopleApi.remove(id),
    onSuccess: () => {
      notify("Person deleted");
      void qc.invalidateQueries({ queryKey: keys.people });
      setConfirmDelete(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const [confirmDelete, setConfirmDelete] = useState<PersonWithCount | null>(
    null
  );

  const rows: PersonWithCount[] = useMemo(
    () => (listQ.data?.pages ?? []).flatMap((p) => p.items ?? []),
    [listQ.data]
  );

  return (
    <>
      <Typography variant="h4" sx={{ mb: 2 }}>
        People
      </Typography>

      {listQ.error ? <ErrorAlert error={listQ.error} /> : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell align="right">Cookies</TableCell>
              <TableCell>Created at</TableCell>
              <TableCell>Last seen</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    No people.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={String(p.id)} data-testid={`person-row-${p.id}`}>
                  <TableCell>{p.email ?? "none"}</TableCell>
                  <TableCell align="right">
                    {String(p.cookieCount ?? 0)}
                  </TableCell>
                  <TableCell>{formatMt(p.createdAt) || "none"}</TableCell>
                  <TableCell>{formatMt(p.lastSeenAt) || "none"}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Delete"
                      onClick={() => setConfirmDelete(p)}
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
        title="Delete person?"
        body={
          confirmDelete
            ? `Delete ${confirmDelete.email ?? "this person"}? Deletes this person's subscriptions and cookies. The Cognito user is removed separately in the console.`
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
