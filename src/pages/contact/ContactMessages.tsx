import { useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Link,
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
import DeleteIcon from "@mui/icons-material/Delete";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { contactMessages as contactMessagesApi } from "../../api/resources/contactMessages";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import type { ContactMessage } from "../../api/types";

export default function ContactMessages() {
  const qc = useQueryClient();
  const notify = useNotify();

  const listQ = useInfiniteQuery({
    queryKey: keys.contactMessages,
    queryFn: ({ pageParam }) =>
      contactMessagesApi.list({ cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => contactMessagesApi.remove(id),
    onSuccess: () => {
      notify("Contact message deleted");
      void qc.invalidateQueries({ queryKey: keys.contactMessages });
      setConfirmDelete(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const [confirmDelete, setConfirmDelete] = useState<ContactMessage | null>(
    null
  );

  const rows: ContactMessage[] = useMemo(
    () => (listQ.data?.pages ?? []).flatMap((p) => p.items ?? []),
    [listQ.data]
  );

  return (
    <>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Contact messages
      </Typography>
      {listQ.error ? <ErrorAlert error={listQ.error} /> : null}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Created at</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Body</TableCell>
              <TableCell>Client IP</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No contact messages.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow
                  key={String(m.id)}
                  data-testid={`contact-row-${m.id}`}
                >
                  <TableCell>{formatMt(m.createdAt) || "none"}</TableCell>
                  <TableCell>{m.name ?? "none"}</TableCell>
                  <TableCell>
                    {m.email ? (
                      <Link href={`mailto:${m.email}`}>{m.email}</Link>
                    ) : (
                      "none"
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "pre-wrap" }}>
                    {m.body ?? ""}
                  </TableCell>
                  <TableCell>
                    <code>{m.clientIp ?? "none"}</code>
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                    >
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete"
                        onClick={() => setConfirmDelete(m)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
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
        title="Delete contact message?"
        body={
          confirmDelete
            ? `Delete this message from ${confirmDelete.name ?? "unknown"}? This cannot be undone.`
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
