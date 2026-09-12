import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
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
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiKeys as apiKeysApi } from "../../api/resources/apiKeys";
import type { ApiKeyCreateBody } from "../../api/resources/apiKeys";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import KeyRevealDialog from "../../components/KeyRevealDialog";
import { useNotify } from "../../hooks/useNotify";
import { useNow } from "../../hooks/useNow";
import { ageS, formatAgeS, formatMt } from "../../lib/time";
import type { ApiKey, ApiKeyMinted } from "../../api/types";
import ApiKeyCreateDialog, { CAPABILITY_LABELS } from "./ApiKeyCreateDialog";

const LABEL_BY_VALUE = new Map(
  CAPABILITY_LABELS.map((c) => [c.value, c.label] as const)
);

type Status = "active" | "expired" | "revoked";

function statusOf(key: ApiKey, nowMs: number): Status {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt) {
    const t = Date.parse(key.expiresAt);
    if (!Number.isNaN(t) && t <= nowMs) return "expired";
  }
  return "active";
}

export default function ApiKeysList() {
  const qc = useQueryClient();
  const notify = useNotify();
  const now = useNow(60_000);

  const listQ = useQuery({
    queryKey: keys.apiKeys,
    queryFn: () => apiKeysApi.list(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<ApiKey | null>(null);
  const [minted, setMinted] = useState<ApiKeyMinted | null>(null);

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: keys.apiKeys });

  const createMut = useMutation({
    mutationFn: (b: ApiKeyCreateBody) => apiKeysApi.create(b),
    onSuccess: (m) => {
      notify("API key minted");
      invalidate();
      setCreateOpen(false);
      setMinted(m);
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => apiKeysApi.revoke(id),
    onSuccess: () => {
      notify("API key revoked");
      invalidate();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Revoke failed", "error"),
    onSettled: () => setConfirmRevoke(null),
  });

  const rows = useMemo(() => {
    const items = listQ.data?.items ?? [];
    return [...items].sort((a, b) => {
      const at = Date.parse(a.createdAt ?? "") || 0;
      const bt = Date.parse(b.createdAt ?? "") || 0;
      return bt - at;
    });
  }, [listQ.data]);

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">API keys</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New key
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Keys let a script or an agent, such as Claude Code, configure the site
        without signing in. A key is shown once.
      </Typography>

      {listQ.error ? (
        <ErrorAlert error={listQ.error} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Key prefix</TableCell>
                <TableCell>Capabilities</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Created by</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Typography variant="body2" color="text.secondary">
                      No keys yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((k) => {
                  const status = statusOf(k, now);
                  const revoked = status === "revoked";
                  const expired = status === "expired";
                  return (
                    <TableRow
                      key={String(k.id)}
                      hover
                      data-testid={`api-key-row-${k.id}`}
                      sx={revoked ? { opacity: 0.5 } : undefined}
                    >
                      <TableCell>{k.name}</TableCell>
                      <TableCell>
                        <code>{k.keyPrefix}</code>
                      </TableCell>
                      <TableCell>
                        {k.allCapabilities ? (
                          <Chip size="small" label="All" color="primary" />
                        ) : (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            flexWrap="wrap"
                            useFlexGap
                          >
                            {(k.capabilities ?? []).map((c) => (
                              <Chip
                                key={c}
                                size="small"
                                label={LABEL_BY_VALUE.get(c as never) ?? c}
                              />
                            ))}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        {k.expiresAt ? (
                          <Box
                            component="span"
                            sx={{
                              color: expired ? "error.main" : "text.primary",
                            }}
                          >
                            {formatMt(k.expiresAt)}
                          </Box>
                        ) : (
                          <Box component="span" sx={{ color: "text.secondary" }}>
                            Never
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <span title={formatMt(k.lastUsedAt) || undefined}>
                          {formatAgeS(ageS(k.lastUsedAt ?? null, now)) ||
                            "never"}
                        </span>
                      </TableCell>
                      <TableCell>{k.createdBy}</TableCell>
                      <TableCell>{formatMt(k.createdAt)}</TableCell>
                      <TableCell>
                        {status === "active" ? (
                          <Chip size="small" label="Active" color="success" />
                        ) : status === "expired" ? (
                          <Chip size="small" label="Expired" color="warning" />
                        ) : (
                          <Chip size="small" label="Revoked" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {!revoked ? (
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Revoke"
                            onClick={() => setConfirmRevoke(k)}
                          >
                            <DeleteForeverIcon fontSize="small" />
                          </IconButton>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ApiKeyCreateDialog
        open={createOpen}
        submitting={createMut.isPending}
        error={createMut.error}
        onCancel={() => {
          setCreateOpen(false);
          createMut.reset();
        }}
        onSubmit={(b) => createMut.mutate(b)}
      />

      {confirmRevoke ? (
        <ConfirmDialog
          open={true}
          title="Revoke API key?"
          body={`Revoke ${confirmRevoke.name ?? "key"}? Anything using it stops working immediately.`}
          confirmLabel="Revoke"
          danger
          disabled={revokeMut.isPending}
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={() => revokeMut.mutate(Number(confirmRevoke.id))}
        />
      ) : null}

      {minted ? (
        <KeyRevealDialog
          open={true}
          title={`New API key: ${minted.name ?? ""}`}
          beaconKey={minted.key ?? ""}
          onClose={() => setMinted(null)}
        />
      ) : null}
    </>
  );
}
