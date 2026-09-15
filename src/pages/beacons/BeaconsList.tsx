import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { beacons as beaconsApi } from "../../api/resources/beacons";
import type {
  BeaconsResponse,
  KeyMint,
} from "../../api/resources/beacons";
import { events as eventsApi } from "../../api/resources/events";
import { keys } from "../../queries/keys";
import { polled } from "../../queries/polling";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import FlagChip from "../../components/FlagChip";
import KeyRevealDialog from "../../components/KeyRevealDialog";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { useNotify } from "../../hooks/useNotify";
import { useNow } from "../../hooks/useNow";
import { ageS, formatAgeS, formatMt } from "../../lib/time";
import { beaconFlags } from "../../lib/beaconFlags";
import type { Beacon } from "../../api/types";
import PageHeader from "../../components/layout/PageHeader";
import BeaconCreateDialog, {
  type CreateBeaconBody,
} from "./BeaconCreateDialog";

type Action = "activate" | "deactivate" | "rotate" | "revoke";

type Confirm = {
  action: Action;
  beacon: Beacon;
};

function hubStateLabel(b: Beacon): string {
  if (b.hubAllowed === false) return "off (HTTP only)";
  if (b.hubConnected === true) return "connected";
  if (b.hubConnected === false) return "polling";
  return "unknown";
}

function fixesLabel(b: Beacon): string {
  const stored = Number(b.fixesStored ?? 0).toLocaleString("en-US");
  const carried = Number(b.fixesCarried ?? 0).toLocaleString("en-US");
  const dropped = Number(b.fixesRateLimited ?? 0).toLocaleString("en-US");
  return `${stored} / ${carried} / ${dropped}`;
}

export default function BeaconsList() {
  const qc = useQueryClient();
  const notify = useNotify();
  const now = useNow();
  const navigate = useNavigate();

  const beaconsQ = useQuery({
    queryKey: keys.beacons,
    queryFn: () => beaconsApi.list(),
    ...polled,
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [keyMint, setKeyMint] = useState<KeyMint | null>(null);
  const [keyMintTitle, setKeyMintTitle] = useState("New beacon key");
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    beacon: Beacon;
  } | null>(null);

  const invalidateBeacons = () =>
    void qc.invalidateQueries({ queryKey: keys.beacons });

  const createMut = useMutation({
    mutationFn: (b: CreateBeaconBody) => beaconsApi.create(b),
    onSuccess: (mint) => {
      notify("Beacon created");
      invalidateBeacons();
      setCreateOpen(false);
      setKeyMintTitle(`New beacon key for ${mint.beacon.name ?? "beacon"}`);
      setKeyMint(mint);
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => beaconsApi.activate(id),
    onSuccess: () => {
      notify("Beacon activated");
      invalidateBeacons();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Activate failed", "error"),
    onSettled: () => setConfirm(null),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: number) => beaconsApi.deactivate(id),
    onSuccess: () => {
      notify("Beacon deactivated");
      invalidateBeacons();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Deactivate failed", "error"),
    onSettled: () => setConfirm(null),
  });

  const rotateMut = useMutation({
    mutationFn: (id: number) => beaconsApi.rotate(id),
    onSuccess: (mint) => {
      notify("Key rotated");
      invalidateBeacons();
      setKeyMintTitle(`Rotated key for ${mint.beacon.name ?? "beacon"}`);
      setKeyMint(mint);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Rotate failed", "error"),
    onSettled: () => setConfirm(null),
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => beaconsApi.revoke(id),
    onSuccess: () => {
      notify("Beacon revoked");
      invalidateBeacons();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Revoke failed", "error"),
    onSettled: () => setConfirm(null),
  });

  const response: BeaconsResponse = beaconsQ.data ?? {
    items: [],
    staleAfterS: 60,
  };
  const sorted = [...response.items].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "")
  );
  const activeBeacons = sorted.filter(
    (b) => b.revokedAt === null || b.revokedAt === undefined
  );
  const revokedBeacons = sorted.filter(
    (b) => b.revokedAt !== null && b.revokedAt !== undefined
  );
  const events = eventsQ.data?.items ?? [];
  const anyEventLive = events.some((e) => Number(e.statusId) === 3);
  const staleAfterS = Number(response.staleAfterS ?? 60);

  const confirmSpec = useMemo(
    () => (confirm ? confirmSpecFor(confirm, anyEventLive) : null),
    [confirm, anyEventLive]
  );

  const runConfirm = () => {
    if (!confirm) return;
    const id = Number(confirm.beacon.id);
    switch (confirm.action) {
      case "activate":
        activateMut.mutate(id);
        return;
      case "deactivate":
        deactivateMut.mutate(id);
        return;
      case "rotate":
        rotateMut.mutate(id);
        return;
      case "revoke":
        revokeMut.mutate(id);
        return;
    }
  };

  const closeMenu = () => setMenuAnchor(null);

  const activeColumns: Column<Beacon>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (b) => <RouterLink to={`/beacons/${b.id}`}>{b.name}</RouterLink>,
    },
    {
      key: "keyPrefix",
      header: "Key prefix",
      role: "subtitle",
      render: (b) => (
        <Box component="code" sx={{ overflowWrap: "anywhere" }}>
          {b.keyPrefix}
        </Box>
      ),
    },
    {
      key: "active",
      header: "Active",
      role: "chip",
      render: (b) =>
        b.isActive ? (
          <Chip size="small" label="Active" color="success" />
        ) : (
          <Box component="span" sx={{ color: "text.secondary" }}>
            none
          </Box>
        ),
      renderCompact: (b) =>
        b.isActive ? (
          <Chip size="small" label="Active" color="success" />
        ) : null,
    },
    {
      key: "healthy",
      header: "Healthy",
      role: "chip",
      render: (b) => {
        const isHealthy = b.healthy === true;
        return (
          <Chip
            size="small"
            label={isHealthy ? "Healthy" : "Unhealthy"}
            color={isHealthy ? "success" : "error"}
          />
        );
      },
    },
    {
      key: "hub",
      header: "Hub",
      role: "chip",
      render: (b) => (
        <Chip size="small" variant="outlined" label={hubStateLabel(b)} />
      ),
    },
    {
      key: "flags",
      header: "Flags",
      role: "chip",
      render: (b) => {
        const flags = beaconFlags(b, staleAfterS, anyEventLive, now);
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {flags.map((f) => (
              <FlagChip key={f} flag={f} />
            ))}
          </Stack>
        );
      },
    },
    {
      key: "lastSeen",
      header: "Last seen",
      role: "line",
      render: (b) => (
        <span title={formatMt(b.lastSeenAt) || undefined}>
          {formatAgeS(ageS(b.lastSeenAt ?? null, now)) || "never"}
        </span>
      ),
    },
    {
      key: "lastHeartbeat",
      header: "Last heartbeat",
      role: "line",
      render: (b) => (
        <span title={formatMt(b.lastHeartbeatAt) || undefined}>
          {formatAgeS(ageS(b.lastHeartbeatAt ?? null, now)) || "never"}
        </span>
      ),
    },
    {
      key: "lastLocation",
      header: "Last location",
      role: "line",
      render: (b) => (
        <span title={formatMt(b.lastLocationAt) || undefined}>
          {formatAgeS(ageS(b.lastLocationAt ?? null, now)) || "never"}
        </span>
      ),
    },
    {
      key: "fixes",
      header: "Fixes",
      role: "line",
      label: "fixes",
      render: (b) => fixesLabel(b),
    },
  ];

  const revokedColumns: Column<Beacon>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (b) => <RouterLink to={`/beacons/${b.id}`}>{b.name}</RouterLink>,
    },
    {
      key: "keyPrefix",
      header: "Key prefix",
      role: "subtitle",
      render: (b) => (
        <Box component="code" sx={{ overflowWrap: "anywhere" }}>
          {b.keyPrefix}
        </Box>
      ),
    },
    {
      key: "revoked",
      header: "Active",
      role: "chip",
      render: () => <Chip size="small" label="Revoked" color="default" />,
    },
    {
      key: "lastSeen",
      header: "Last seen",
      role: "line",
      render: (b) => (
        <span title={formatMt(b.lastSeenAt) || undefined}>
          {formatAgeS(ageS(b.lastSeenAt ?? null, now)) || "never"}
        </span>
      ),
    },
    {
      key: "lastHeartbeat",
      header: "Last heartbeat",
      role: "line",
      render: (b) => (
        <span title={formatMt(b.lastHeartbeatAt) || undefined}>
          {formatAgeS(ageS(b.lastHeartbeatAt ?? null, now)) || "never"}
        </span>
      ),
    },
    {
      key: "lastLocation",
      header: "Last location",
      role: "line",
      render: (b) => (
        <span title={formatMt(b.lastLocationAt) || undefined}>
          {formatAgeS(ageS(b.lastLocationAt ?? null, now)) || "never"}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Beacons"
        actions={
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            New beacon
          </Button>
        }
      />

      {beaconsQ.error ? (
        <ErrorAlert error={beaconsQ.error} />
      ) : (
        <>
          <ResponsiveTable<Beacon>
            rows={activeBeacons}
            columns={activeColumns}
            rowKey={(b) => String(b.id)}
            rowTestId={(b) => `beacon-row-${b.id}`}
            emptyText="No beacons yet."
            actions={(b) => (
              <Stack
                direction="row"
                spacing={0.5}
                justifyContent="flex-end"
              >
                <IconButton
                  size="small"
                  component={RouterLink}
                  to={`/beacons/${b.id}`}
                  aria-label={`Edit ${b.name ?? "beacon"}`}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Actions for ${b.name ?? "beacon"}`}
                  onClick={(ev) =>
                    setMenuAnchor({ el: ev.currentTarget, beacon: b })
                  }
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Stack>
            )}
            audit={(b) => ({
              entity: "beacon",
              entityId: b.id ?? "",
              name: b.name ?? "beacon",
              audit: b.audit,
            })}
          />

          {revokedBeacons.length > 0 ? (
            <Accordion
              disableGutters
              sx={{ mt: 2 }}
              data-testid="revoked-beacons-accordion"
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Revoked ({revokedBeacons.length})</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <ResponsiveTable<Beacon>
                  rows={revokedBeacons}
                  columns={revokedColumns}
                  rowKey={(b) => String(b.id)}
                  rowTestId={(b) => `beacon-row-${b.id}`}
                  rowSx={() => ({ opacity: 0.5 })}
                  actions={(b) => (
                    <IconButton
                      size="small"
                      component={RouterLink}
                      to={`/beacons/${b.id}`}
                      aria-label={`Edit ${b.name ?? "beacon"}`}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                  audit={(b) => ({
                    entity: "beacon",
                    entityId: b.id ?? "",
                    name: b.name ?? "beacon",
                    audit: b.audit,
                  })}
                  emptyText="No revoked beacons."
                />
              </AccordionDetails>
            </Accordion>
          ) : null}
        </>
      )}

      <BeaconCreateDialog
        open={createOpen}
        submitting={createMut.isPending}
        error={createMut.error}
        onCancel={() => {
          setCreateOpen(false);
          createMut.reset();
        }}
        onSubmit={(b) => createMut.mutate(b)}
      />

      {menuAnchor ? (
        <Menu
          open
          anchorEl={menuAnchor.el}
          onClose={closeMenu}
        >
          {!menuAnchor.beacon.isActive ? (
            <MenuItem
              onClick={() => {
                setConfirm({ action: "activate", beacon: menuAnchor.beacon });
                closeMenu();
              }}
            >
              Activate
            </MenuItem>
          ) : null}
          {menuAnchor.beacon.isActive ? (
            <MenuItem
              onClick={() => {
                setConfirm({ action: "deactivate", beacon: menuAnchor.beacon });
                closeMenu();
              }}
            >
              Deactivate
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={() => {
              setConfirm({ action: "rotate", beacon: menuAnchor.beacon });
              closeMenu();
            }}
          >
            Rotate
          </MenuItem>
          <MenuItem
            onClick={() => {
              setConfirm({ action: "revoke", beacon: menuAnchor.beacon });
              closeMenu();
            }}
          >
            Revoke
          </MenuItem>
          <MenuItem
            onClick={() => {
              navigate(`/beacons/${menuAnchor.beacon.id}`);
              closeMenu();
            }}
          >
            Open
          </MenuItem>
        </Menu>
      ) : null}

      {confirmSpec ? (
        <ConfirmDialog
          open={true}
          title={confirmSpec.title}
          body={confirmSpec.body}
          confirmLabel={confirmSpec.confirmLabel}
          danger={confirmSpec.danger}
          disabled={
            activateMut.isPending ||
            deactivateMut.isPending ||
            rotateMut.isPending ||
            revokeMut.isPending
          }
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirm}
        />
      ) : null}

      {keyMint ? (
        <KeyRevealDialog
          open={true}
          title={keyMintTitle}
          beaconKey={keyMint.key}
          enrollment={keyMint.enrollment}
          onClose={() => setKeyMint(null)}
        />
      ) : null}
    </>
  );
}

function confirmSpecFor(
  c: Confirm,
  anyEventLive: boolean
): {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
} {
  const name = c.beacon.name ?? "beacon";
  const isActive = c.beacon.isActive === true;
  const liveNote =
    isActive && anyEventLive
      ? " Location fan-out stops until another beacon is activated."
      : "";
  switch (c.action) {
    case "activate":
      return {
        title: "Activate beacon?",
        body: `Activate ${name}? Only its updates are published, starting with its next update.`,
        confirmLabel: "Activate",
      };
    case "deactivate":
      return {
        title: "Deactivate beacon?",
        body: `Deactivate ${name}?${liveNote}`,
        confirmLabel: "Deactivate",
      };
    case "rotate": {
      const rotateLive =
        isActive && anyEventLive
          ? " Location fan-out stops until this phone is re-enrolled with the new key or another beacon is activated."
          : "";
      return {
        title: "Rotate key?",
        body: `Rotate the key for ${name}? The current key stops working immediately and the phone must be re-enrolled with the new key.${rotateLive}`,
        confirmLabel: "Rotate",
        danger: true,
      };
    }
    case "revoke":
      return {
        title: "Revoke beacon?",
        body: `Revoke ${name}? This is permanent.${liveNote}`,
        confirmLabel: "Revoke",
        danger: true,
      };
  }
}
