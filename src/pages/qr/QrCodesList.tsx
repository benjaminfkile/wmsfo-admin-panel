import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qr as qrApi } from "../../api/resources/qr";
import { places as placesApi } from "../../api/resources/places";
import { keys } from "../../queries/keys";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { useNotify } from "../../hooks/useNotify";
import { useAuth } from "../../auth/AuthProvider";
import { formatMt, formatMtDate } from "../../lib/time";
import type { Place, QrCode } from "../../api/types";
import PrintSheetDialog from "./PrintSheetDialog";
import AttachDialog from "./AttachDialog";
import { formatOpens } from "./qrHelpers";

export default function QrCodesList() {
  const qc = useQueryClient();
  const notify = useNotify();
  const { state } = useAuth();
  const isAdmin = state.kind === "member" && state.role === "admin";

  const listQ = useQuery({
    queryKey: keys.qrCodes,
    queryFn: () => qrApi.list(),
  });
  const placesQ = useQuery({
    queryKey: keys.places,
    queryFn: () => placesApi.list(),
  });

  const rows = useMemo<QrCode[]>(() => {
    const items = listQ.data?.items ?? [];
    // Sorted by tag per admin.md 6.23.
    return [...items].sort((a, b) => a.tag.localeCompare(b.tag));
  }, [listQ.data]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.qrCodes });
  };

  const [count, setCount] = useState<number>(10);
  const generateMut = useMutation({
    mutationFn: () => qrApi.generate({ count }),
    onSuccess: (res) => {
      notify(`Generated ${res.items.length} codes`);
      invalidate();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Generate failed", "error"),
  });

  const [printOpen, setPrintOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<QrCode | null>(null);
  const [attachTarget, setAttachTarget] = useState<QrCode | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    row: QrCode;
  } | null>(null);

  const detachMut = useMutation({
    mutationFn: (id: number) => qrApi.detach(id),
    onSuccess: () => {
      notify("Detached");
      invalidate();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Detach failed", "error"),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      qrApi.patch(id, { active }),
    onSuccess: (row) => {
      notify(row.active ? "Enabled" : "Disabled");
      invalidate();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Patch failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => qrApi.remove(id),
    onSuccess: () => {
      notify("Deleted");
      invalidate();
    },
    onSettled: () => setConfirmDelete(null),
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const attachMut = useMutation({
    mutationFn: ({ id, placeId }: { id: number; placeId: number }) =>
      qrApi.attach(id, { placeId }),
    onSuccess: () => {
      notify("Attached");
      invalidate();
    },
    onSettled: () => setAttachTarget(null),
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Attach failed", "error"),
  });

  const placeItems: Place[] = placesQ.data?.items ?? [];

  const columns: Column<QrCode>[] = [
    {
      key: "tag",
      header: "Tag",
      role: "title",
      render: (row) => (
        <RouterLink to={`/qr-codes/${row.id}`}>{row.tag}</RouterLink>
      ),
    },
    {
      key: "attachedTo",
      header: "Attached to",
      role: "chip",
      render: (row) => {
        const hasScans = row.scans.people > 0;
        return row.attachment ? (
          row.attachment.placePath.join(" › ")
        ) : (
          <Chip
            size="small"
            label="Unattached"
            color={hasScans ? "warning" : "default"}
            variant={hasScans ? "filled" : "outlined"}
          />
        );
      },
    },
    {
      key: "opens",
      header: "Opens",
      role: "line",
      label: "Opens",
      render: (row) => formatOpens(row.opens, row.opensSource),
    },
    {
      key: "people",
      header: "People",
      role: "line",
      label: "People",
      align: "right",
      render: (row) => row.scans.people,
    },
    {
      key: "lastScan",
      header: "Last scan",
      role: "line",
      label: "Last scan",
      render: (row) => (
        <Tooltip title={formatMt(row.scans.lastScanAt) || ""}>
          <span>
            {row.scans.lastScanAt
              ? formatMtDate(row.scans.lastScanAt)
              : "never"}
          </span>
        </Tooltip>
      ),
    },
    {
      key: "printed",
      header: "Printed",
      role: "line",
      label: "Printed",
      render: (row) => `Batch ${row.batchNo} · ${formatMtDate(row.printedAt)}`,
    },
  ];

  return (
    <>
      <PageHeader
        title="QR codes"
        actions={
          <>
            <TextField
              size="small"
              type="number"
              label="Generate"
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value);
                setCount(Number.isFinite(n) && n > 0 ? Math.min(100, Math.floor(n)) : 10);
              }}
              inputProps={{ min: 1, max: 100, "aria-label": "Number to generate" }}
              sx={{ width: { xs: "100%", sm: 120 } }}
            />
            <Button
              variant="contained"
              onClick={() => generateMut.mutate()}
              disabled={generateMut.isPending}
            >
              Generate {count} more
            </Button>
            <Button variant="outlined" onClick={() => setPrintOpen(true)}>
              Print sheet
            </Button>
          </>
        }
      />

      {listQ.error ? <ErrorAlert error={listQ.error} /> : null}
      {generateMut.error ? <ErrorAlert error={generateMut.error} /> : null}

      {rows.length === 0 && !listQ.isLoading ? (
        <Alert severity="info">
          No codes yet. Generate a batch above to get started.
        </Alert>
      ) : (
        <ResponsiveTable<QrCode>
          rows={rows}
          columns={columns}
          rowKey={(row) => String(row.id)}
          rowTestId={(row) => `qr-code-row-${row.id}`}
          rowSx={(row) => (!row.active ? { opacity: 0.6 } : {})}
          emptyText="No codes yet."
          actions={(row) => (
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              <IconButton
                component={RouterLink}
                to={`/qr-codes/${row.id}`}
                size="small"
                aria-label={`Edit ${row.tag}`}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Actions for ${row.tag}`}
                onClick={(ev) =>
                  setMenuAnchor({ el: ev.currentTarget, row })
                }
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
          audit={(row) => ({
            entity: "qr_code",
            entityId: row.id,
            name: row.tag,
            audit: row.audit,
          })}
        />
      )}

      {menuAnchor ? (
        <Menu open anchorEl={menuAnchor.el} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setAttachTarget(menuAnchor.row);
              setMenuAnchor(null);
            }}
          >
            Attach…
          </MenuItem>
          <MenuItem
            disabled={!menuAnchor.row.attachment}
            onClick={() => {
              detachMut.mutate(Number(menuAnchor.row.id));
              setMenuAnchor(null);
            }}
          >
            Detach
          </MenuItem>
          <MenuItem
            onClick={() => {
              patchMut.mutate({
                id: Number(menuAnchor.row.id),
                active: !menuAnchor.row.active,
              });
              setMenuAnchor(null);
            }}
          >
            {menuAnchor.row.active ? "Disable" : "Enable"}
          </MenuItem>
          {isAdmin ? (
            <MenuItem
              onClick={() => {
                setConfirmDelete(menuAnchor.row);
                setMenuAnchor(null);
              }}
            >
              Delete
            </MenuItem>
          ) : null}
        </Menu>
      ) : null}

      <PrintSheetDialog
        open={printOpen}
        codes={rows}
        onClose={() => setPrintOpen(false)}
      />

      {attachTarget ? (
        <AttachDialog
          open
          places={placeItems}
          onCancel={() => setAttachTarget(null)}
          onSubmit={(placeId) =>
            attachMut.mutate({ id: Number(attachTarget.id), placeId })
          }
          submitting={attachMut.isPending}
          error={attachMut.error}
        />
      ) : null}

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="qr-codes"
          id={Number(confirmDelete.id)}
          name={confirmDelete.tag}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(Number(confirmDelete.id))}
        />
      ) : null}
    </>
  );
}
