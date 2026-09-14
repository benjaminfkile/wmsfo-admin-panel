import { useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Link,
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
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
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

  const columns: Column<ContactMessage>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (m) => m.name ?? "none",
    },
    {
      key: "email",
      header: "Email",
      role: "line",
      render: (m) =>
        m.email ? <Link href={`mailto:${m.email}`}>{m.email}</Link> : "none",
    },
    {
      key: "createdAt",
      header: "Created at",
      label: "Created",
      role: "line",
      render: (m) => formatMt(m.createdAt) || "none",
    },
    {
      key: "clientIp",
      header: "Client IP",
      role: "line",
      render: (m) => (
        <Box component="code" sx={{ overflowWrap: "anywhere" }}>
          {m.clientIp ?? "none"}
        </Box>
      ),
    },
    {
      key: "body",
      header: "Body",
      role: "line",
      render: (m) => (
        <Typography
          variant="body2"
          component="span"
          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {m.body ?? ""}
        </Typography>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Contact messages" />
      {listQ.error ? <ErrorAlert error={listQ.error} /> : null}
      <ResponsiveTable<ContactMessage>
        rows={rows}
        columns={columns}
        rowKey={(m) => String(m.id)}
        rowTestId={(m) => `contact-row-${m.id}`}
        emptyText="No contact messages."
        actions={(m) => (
          <IconButton
            size="small"
            color="error"
            aria-label="Delete"
            onClick={() => setConfirmDelete(m)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
        audit={(m) => ({
          entity: "contact_message",
          entityId: m.id ?? "",
          name: m.name ?? "contact message",
          audit: m.audit,
        })}
      />

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

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="contact-messages"
          id={Number(confirmDelete.id)}
          name={`message from ${confirmDelete.name ?? "unknown"}`}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(Number(confirmDelete.id))}
        />
      ) : null}
    </>
  );
}
