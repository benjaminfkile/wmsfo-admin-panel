import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import DeleteIcon from "@mui/icons-material/Delete";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { people as peopleApi } from "../../api/resources/people";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../../components/ConfirmDialog";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { useNotify } from "../../hooks/useNotify";
import { formatStamp } from "../../lib/time";
import HelpButton from "../../help/HelpButton";
import type { Person, SignupBlock } from "../../api/types";
import BlockDialog from "./BlockDialog";
import { PERSON_DELETE_NOTE, accounts, blockLabel } from "./blocks";

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

  const blocksQ = useQuery({
    queryKey: keys.peopleBlocks,
    queryFn: () => peopleApi.blocks.list(),
  });
  const blocks: SignupBlock[] = useMemo(
    () => blocksQ.data?.items ?? [],
    [blocksQ.data]
  );

  const [blockOpen, setBlockOpen] = useState(false);
  const [confirmUnblock, setConfirmUnblock] = useState<SignupBlock | null>(
    null
  );

  const unblockMut = useMutation({
    mutationFn: (id: number) => peopleApi.blocks.remove(id),
    onSuccess: () => {
      notify("Unblocked");
      void qc.invalidateQueries({ queryKey: keys.peopleBlocks });
      setConfirmUnblock(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Unblock failed", "error"),
  });

  const onBlocked = (removed: number) => {
    setBlockOpen(false);
    notify(removed > 0 ? `Blocked, ${accounts(removed)} removed` : "Blocked");
    // keys.people prefixes the blocks key, so both lists refresh.
    void qc.invalidateQueries({ queryKey: keys.people });
  };

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
      render: (p) => formatStamp(p.createdAt) || "none",
    },
    {
      key: "lastSeenAt",
      header: "Last seen",
      role: "line",
      render: (p) => formatStamp(p.lastSeenAt) || "none",
    },
  ];

  const blockColumns: Column<SignupBlock>[] = [
    {
      key: "pattern",
      header: "Address or domain",
      role: "title",
      render: (b) => (
        <Box component="span" sx={{ wordBreak: "break-all" }}>
          {blockLabel(b)}
        </Box>
      ),
    },
    {
      key: "note",
      header: "Note",
      role: "line",
      render: (b) => (
        <Box component="span" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {b.note ?? ""}
        </Box>
      ),
    },
    {
      key: "createdBy",
      header: "By",
      role: "line",
      render: (b) => b.createdBy ?? "unknown",
    },
    {
      key: "createdAt",
      header: "When",
      role: "line",
      render: (b) => formatStamp(b.createdAt) || "none",
    },
    {
      // A chip so it disappears from the card, not only the cell, at 0.
      key: "matchingCount",
      header: "Accounts",
      role: "chip",
      render: (b) => {
        const n = Number(b.matchingCount ?? 0);
        return n > 0 ? (
          <Chip size="small" color="warning" label={`${accounts(n)} now`} />
        ) : null;
      },
    },
  ];

  return (
    <>
      <PageHeader title="People" help="people" />

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

      <Box component="section" sx={{ mt: 4 }} data-testid="blocked-section">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ mb: 1 }}
        >
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h2">
              Blocked addresses and domains
            </Typography>
            <HelpButton topic="people.blocked" />
          </Stack>
          <Button
            variant="contained"
            color="error"
            startIcon={<BlockIcon />}
            onClick={() => setBlockOpen(true)}
          >
            Block
          </Button>
        </Stack>

        {blocksQ.error ? <ErrorAlert error={blocksQ.error} /> : null}

        <ResponsiveTable<SignupBlock>
          rows={blocks}
          columns={blockColumns}
          rowKey={(b) => String(b.id)}
          rowTestId={(b) => `block-row-${b.id}`}
          emptyText="Nothing is blocked."
          actions={(b) => (
            <IconButton
              size="small"
              aria-label={`Unblock ${b.pattern ?? ""}`}
              onClick={() => setConfirmUnblock(b)}
            >
              <LockOpenIcon fontSize="small" />
            </IconButton>
          )}
          audit={(b) => ({
            entity: "signup_block",
            entityId: b.id ?? "",
            name: b.pattern ?? "block",
            audit: null,
          })}
        />
      </Box>

      <BlockDialog
        open={blockOpen}
        onCancel={() => setBlockOpen(false)}
        onBlocked={onBlocked}
      />

      {confirmUnblock ? (
        <ConfirmDialog
          open
          title="Unblock"
          body={`Unblock ${confirmUnblock.pattern ?? ""}? They can sign up again as a new person.`}
          confirmLabel="Unblock"
          disabled={unblockMut.isPending}
          onCancel={() => setConfirmUnblock(null)}
          onConfirm={() => unblockMut.mutate(Number(confirmUnblock.id))}
        />
      ) : null}

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="people"
          id={Number(confirmDelete.id)}
          name={confirmDelete.email ?? "person"}
          note={PERSON_DELETE_NOTE}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(Number(confirmDelete.id))}
        />
      ) : null}
    </>
  );
}
