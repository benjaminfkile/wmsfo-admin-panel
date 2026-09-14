import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiKeys as apiKeysApi } from "../../api/resources/apiKeys";
import type { ApiKeyCreateBody } from "../../api/resources/apiKeys";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import KeyRevealDialog from "../../components/KeyRevealDialog";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
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
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    key: ApiKey;
  } | null>(null);

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

  const statusChip = (k: ApiKey): { status: Status; node: React.ReactNode } => {
    const status = statusOf(k, now);
    const node =
      status === "active" ? (
        <Chip size="small" label="Active" color="success" />
      ) : status === "expired" ? (
        <Chip size="small" label="Expired" color="warning" />
      ) : (
        <Chip size="small" label="Revoked" />
      );
    return { status, node };
  };

  const columns: Column<ApiKey>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (k) => k.name ?? "",
    },
    {
      key: "keyPrefix",
      header: "Key prefix",
      role: "subtitle",
      render: (k) => (
        <Box component="code" sx={{ overflowWrap: "anywhere" }}>
          {k.keyPrefix}
        </Box>
      ),
    },
    {
      key: "status",
      header: "Status",
      role: "chip",
      render: (k) => statusChip(k).node,
    },
    {
      key: "capabilities",
      header: "Capabilities",
      role: "chip",
      render: (k) =>
        k.allCapabilities ? (
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
        ),
    },
    {
      key: "expires",
      header: "Expires",
      role: "line",
      render: (k) => {
        const s = statusOf(k, now);
        return k.expiresAt ? (
          <Box
            component="span"
            sx={{
              color: s === "expired" ? "error.main" : "text.primary",
            }}
          >
            {formatMt(k.expiresAt)}
          </Box>
        ) : (
          <Box component="span" sx={{ color: "text.secondary" }}>
            Never
          </Box>
        );
      },
    },
    {
      key: "lastUsed",
      header: "Last used",
      role: "line",
      render: (k) => (
        <span title={formatMt(k.lastUsedAt) || undefined}>
          {formatAgeS(ageS(k.lastUsedAt ?? null, now)) || "never"}
        </span>
      ),
    },
    {
      key: "createdBy",
      header: "Created by",
      role: "line",
      render: (k) => k.createdBy ?? "",
    },
    {
      key: "createdAt",
      header: "Created",
      role: "line",
      render: (k) => formatMt(k.createdAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="API keys"
        actions={
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            New key
          </Button>
        }
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Keys let a script or an agent, such as Claude Code, configure the site
        without signing in. A key is shown once.
      </Typography>

      {listQ.error ? (
        <ErrorAlert error={listQ.error} />
      ) : (
        <ResponsiveTable<ApiKey>
          rows={rows}
          columns={columns}
          rowKey={(k) => String(k.id)}
          rowTestId={(k) => `api-key-row-${k.id}`}
          rowSx={(k) =>
            statusOf(k, now) === "revoked" ? { opacity: 0.5 } : {}
          }
          emptyText="No keys yet."
          actions={(k) => {
            const revoked = statusOf(k, now) === "revoked";
            return revoked ? null : (
              <IconButton
                size="small"
                aria-label={`Actions for ${k.name ?? "key"}`}
                onClick={(ev) =>
                  setMenuAnchor({ el: ev.currentTarget, key: k })
                }
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            );
          }}
          audit={(k) => ({
            entity: "api_key",
            entityId: k.id ?? "",
            name: `key ${k.name ?? "key"}`,
            audit: k.audit,
          })}
        />
      )}

      {menuAnchor ? (
        <Menu
          open
          anchorEl={menuAnchor.el}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setConfirmRevoke(menuAnchor.key);
              setMenuAnchor(null);
            }}
          >
            Revoke
          </MenuItem>
        </Menu>
      ) : null}

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
