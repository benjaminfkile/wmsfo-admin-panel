import { useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { people as peopleApi } from "../../api/resources/people";
import { keys } from "../../queries/keys";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
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

  const columns: Column<PersonWithCount>[] = [
    {
      key: "email",
      header: "Email",
      role: "title",
      render: (p) => p.email ?? "none",
    },
    {
      key: "cookies",
      header: "Cookies",
      align: "right",
      role: "line",
      render: (p) => String(p.cookieCount ?? 0),
    },
    {
      key: "createdAt",
      header: "Created at",
      label: "Created",
      role: "line",
      render: (p) => formatMt(p.createdAt) || "none",
    },
    {
      key: "lastSeenAt",
      header: "Last seen",
      role: "line",
      render: (p) => formatMt(p.lastSeenAt) || "none",
    },
  ];

  return (
    <>
      <PageHeader title="People" />

      {listQ.error ? <ErrorAlert error={listQ.error} /> : null}

      <ResponsiveTable<PersonWithCount>
        rows={rows}
        columns={columns}
        rowKey={(p) => String(p.id)}
        rowTestId={(p) => `person-row-${p.id}`}
        emptyText="No people."
        actions={(p) => (
          <IconButton
            size="small"
            color="error"
            aria-label="Delete"
            onClick={() => setConfirmDelete(p)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
        audit={(p) => ({
          entity: "person",
          entityId: p.id ?? "",
          name: p.email ?? "person",
          audit: p.audit,
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
          resource="people"
          id={Number(confirmDelete.id)}
          name={confirmDelete.email ?? "person"}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(Number(confirmDelete.id))}
        />
      ) : null}
    </>
  );
}
