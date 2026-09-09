import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { content as contentApi } from "../../api/resources/content";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import { formatMt } from "../../lib/time";
import { useNotify } from "../../hooks/useNotify";
import VersionDialog from "./VersionDialog";
import type { ContentVersionInfo } from "../../api/types";

interface Props {
  currentPublishedId: number | null;
}

// Versions list (admin.md 6.18). Newest 50 first with view, restore
// and restore-and-publish row actions. The "Published" chip marks the
// version whose id matches `currentPublishedId`.
export default function VersionsList({ currentPublishedId }: Props) {
  const qc = useQueryClient();
  const notify = useNotify();
  const [viewFor, setViewFor] = useState<ContentVersionInfo | null>(null);
  const [restoreFor, setRestoreFor] = useState<ContentVersionInfo | null>(null);
  const [restorePublishFor, setRestorePublishFor] =
    useState<ContentVersionInfo | null>(null);

  const versionsQ = useQuery({
    queryKey: keys.versions,
    queryFn: () => contentApi.versions(),
  });

  const restoreMut = useMutation({
    mutationFn: (id: number) => contentApi.restore(id),
    onSuccess: () => {
      notify("Draft restored");
      setRestoreFor(null);
      void qc.invalidateQueries({ queryKey: keys.contentStatus });
      void qc.invalidateQueries({ queryKey: keys.pages });
      void qc.invalidateQueries({ queryKey: keys.siteSettings });
    },
  });

  const restorePublishMut = useMutation({
    mutationFn: async (v: ContentVersionInfo) => {
      const id = Number(v.id ?? 0);
      await contentApi.restore(id);
      return contentApi.publish(`Restored from version ${id}`);
    },
    onSuccess: () => {
      notify("Restored and published");
      setRestorePublishFor(null);
      void qc.invalidateQueries({ queryKey: keys.contentStatus });
      void qc.invalidateQueries({ queryKey: keys.versions });
      void qc.invalidateQueries({ queryKey: keys.pages });
      void qc.invalidateQueries({ queryKey: keys.siteSettings });
    },
  });

  const versions = (versionsQ.data?.items ?? []).slice(0, 50);

  return (
    <>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Versions
      </Typography>
      {versionsQ.error ? (
        <ErrorAlert error={versionsQ.error} />
      ) : versions.length === 0 ? (
        <Alert severity="info">No published versions yet.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Publisher</TableCell>
                <TableCell>Time</TableCell>
                <TableCell align="right">Pages</TableCell>
                <TableCell align="right">Sections</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versions.map((v) => {
                const id = Number(v.id ?? 0);
                const isPublished = id === currentPublishedId;
                return (
                  <TableRow key={id} data-testid={`version-row-${id}`}>
                    <TableCell>{id}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{v.label ?? "(no label)"}</span>
                        {isPublished ? (
                          <Chip
                            label="Published"
                            color="success"
                            size="small"
                            data-testid={`version-published-${id}`}
                          />
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>{v.publishedBy ?? "none"}</TableCell>
                    <TableCell>{formatMt(v.publishedAt ?? null)}</TableCell>
                    <TableCell align="right">{String(v.pageCount ?? 0)}</TableCell>
                    <TableCell align="right">
                      {String(v.sectionCount ?? 0)}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => setViewFor(v)}>
                          View
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setRestoreFor(v)}
                          disabled={restoreMut.isPending}
                        >
                          Restore
                        </Button>
                        <Button
                          size="small"
                          color="secondary"
                          onClick={() => setRestorePublishFor(v)}
                          disabled={restorePublishMut.isPending}
                        >
                          Restore and publish
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <VersionDialog
        open={viewFor !== null}
        versionId={viewFor !== null ? Number(viewFor.id ?? 0) : null}
        onClose={() => setViewFor(null)}
      />

      <ConfirmDialog
        open={restoreFor !== null}
        title="Restore version"
        body={
          restoreFor
            ? `Replace the current draft with version ${Number(
                restoreFor.id ?? 0
              )}? Unpublished changes are lost. Nothing is published until you publish.`
            : ""
        }
        confirmLabel="Restore"
        onCancel={() => setRestoreFor(null)}
        onConfirm={() =>
          restoreFor ? restoreMut.mutate(Number(restoreFor.id ?? 0)) : undefined
        }
        disabled={restoreMut.isPending}
      />

      <ConfirmDialog
        open={restorePublishFor !== null}
        title="Restore and publish"
        body={
          restorePublishFor
            ? `Replace the current draft with version ${Number(
                restorePublishFor.id ?? 0
              )}? Unpublished changes are lost. Nothing is published until you publish. The public site updates within its next poll.`
            : ""
        }
        confirmLabel="Restore and publish"
        danger
        onCancel={() => setRestorePublishFor(null)}
        onConfirm={() =>
          restorePublishFor
            ? restorePublishMut.mutate(restorePublishFor)
            : undefined
        }
        disabled={restorePublishMut.isPending}
      />

      {restoreMut.error ? <ErrorAlert error={restoreMut.error} /> : null}
      {restorePublishMut.error ? (
        <ErrorAlert error={restorePublishMut.error} />
      ) : null}
    </>
  );
}
