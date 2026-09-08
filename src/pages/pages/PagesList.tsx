import { useState } from "react";
import {
  Alert,
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
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pages as pagesApi, type PageBody } from "../../api/resources/pages";
import { keys } from "../../queries/keys";
import ErrorAlert from "../../components/ErrorAlert";
import CommentBox from "../../components/CommentBox";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useNotify } from "../../hooks/useNotify";
import PageCreateDialog, {
  type PageCreateSubmit,
} from "./PageCreateDialog";
import PageSettingsDialog, {
  type PageSettingsSubmit,
} from "./PageSettingsDialog";
import type { PageAdmin } from "../../api/types";

const STATUS_ORDER = ["no_event", "planned", "scheduled", "live", "ended", "cancelled"];

function statusRoleLabel(role: string): string {
  switch (role) {
    case "no_event":
      return "No event";
    case "planned":
      return "Planned";
    case "scheduled":
      return "Scheduled";
    case "live":
      return "Live";
    case "ended":
      return "Ended";
    case "cancelled":
      return "Cancelled";
    default:
      return role;
  }
}

// The Pages index (admin.md 6.13). Two groups: status pages in status
// order (locked from delete/reorder), and content ("none") pages in
// nav order with reorder handles.
export default function PagesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsFor, setSettingsFor] = useState<PageAdmin | null>(null);
  const [deleteFor, setDeleteFor] = useState<PageAdmin | null>(null);

  const listQ = useQuery({
    queryKey: keys.pages,
    queryFn: () => pagesApi.list(),
  });

  const items: PageAdmin[] = listQ.data?.items ?? [];
  const statusPages = items
    .filter((p) => p.role !== "none")
    .slice()
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.role ?? "") - STATUS_ORDER.indexOf(b.role ?? "")
    );
  const nonePages = items
    .filter((p) => p.role === "none")
    .slice()
    .sort(
      (a, b) => Number(a.navPosition ?? 0) - Number(b.navPosition ?? 0)
    );

  const createMut = useMutation({
    mutationFn: (body: PageCreateSubmit) =>
      pagesApi.create({
        slug: body.slug,
        title: body.title,
        navLabel: body.navLabel,
      } satisfies PageBody),
    onSuccess: (created) => {
      notify("Page created");
      void qc.invalidateQueries({ queryKey: keys.pages });
      setCreateOpen(false);
      const id = created.id;
      if (id !== undefined && id !== null) navigate(`/pages/${id}`);
    },
  });

  const patchMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Partial<PageBody>;
    }) => pagesApi.patch(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.pages });
    },
  });

  const settingsMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: PageSettingsSubmit;
    }) =>
      pagesApi.patch(id, {
        slug: body.slug,
        title: body.title,
        navLabel: body.navLabel,
        isHidden: body.isHidden,
      }),
    onSuccess: () => {
      notify("Page updated");
      setSettingsFor(null);
      void qc.invalidateQueries({ queryKey: keys.pages });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => pagesApi.remove(id),
    onSuccess: () => {
      notify("Page deleted");
      setDeleteFor(null);
      void qc.invalidateQueries({ queryKey: keys.pages });
    },
  });

  const orderMut = useMutation({
    mutationFn: (ids: number[]) => pagesApi.order(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.pages });
    },
  });

  const move = (index: number, delta: -1 | 1) => {
    const next = nonePages.slice();
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    const cur = next[index];
    const swp = next[to];
    if (!cur || !swp) return;
    next[index] = swp;
    next[to] = cur;
    orderMut.mutate(next.map((p) => Number(p.id ?? 0)));
  };

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">Pages</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New page
        </Button>
      </Stack>
      <CommentBox variant="info">
        Changes here are drafts until you publish.
      </CommentBox>

      {listQ.error ? (
        <ErrorAlert error={listQ.error} />
      ) : (
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Status pages
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Role</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell align="right">Sections</TableCell>
                    <TableCell align="right">Problems</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statusPages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          No status pages.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    statusPages.map((p) => (
                      <TableRow
                        key={String(p.id)}
                        data-testid={`page-row-${p.id}`}
                      >
                        <TableCell>{statusRoleLabel(p.role ?? "")}</TableCell>
                        <TableCell>
                          <RouterLink to={`/pages/${p.id}`}>{p.title}</RouterLink>
                        </TableCell>
                        <TableCell align="right">{p.sectionCount}</TableCell>
                        <TableCell align="right">
                          {Number(p.problemCount ?? 0) > 0 ? (
                            <Chip
                              size="small"
                              color="error"
                              label={p.problemCount}
                            />
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => navigate(`/pages/${p.id}`)}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box>
            <Typography variant="h6" gutterBottom>
              Pages
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Slug</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Nav</TableCell>
                    <TableCell>Hidden</TableCell>
                    <TableCell align="right">Sections</TableCell>
                    <TableCell align="right">Problems</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {nonePages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Alert severity="info">No content pages yet.</Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    nonePages.map((p, i) => (
                      <TableRow
                        key={String(p.id)}
                        data-testid={`page-row-${p.id}`}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <DragIndicatorIcon color="disabled" />
                            <IconButton
                              size="small"
                              onClick={() => move(i, -1)}
                              disabled={i === 0 || orderMut.isPending}
                              aria-label="Move up"
                            >
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => move(i, 1)}
                              disabled={
                                i === nonePages.length - 1 || orderMut.isPending
                              }
                              aria-label="Move down"
                            >
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                        <TableCell>{p.slug}</TableCell>
                        <TableCell>
                          <RouterLink to={`/pages/${p.id}`}>{p.title}</RouterLink>
                        </TableCell>
                        <TableCell>{p.navLabel ?? "not in nav"}</TableCell>
                        <TableCell>{p.isHidden ? "yes" : "no"}</TableCell>
                        <TableCell align="right">{p.sectionCount}</TableCell>
                        <TableCell align="right">
                          {Number(p.problemCount ?? 0) > 0 ? (
                            <Chip
                              size="small"
                              color="error"
                              label={p.problemCount}
                            />
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button
                              size="small"
                              onClick={() => navigate(`/pages/${p.id}`)}
                            >
                              Open
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => setSettingsFor(p)}
                              aria-label="Page settings"
                            >
                              <SettingsIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteFor(p)}
                              aria-label="Delete page"
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
          </Box>
        </Stack>
      )}

      <PageCreateDialog
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onCreate={(body) => createMut.mutate(body)}
        pending={createMut.isPending}
        error={createMut.error}
      />
      {settingsFor ? (
        <PageSettingsDialog
          open={Boolean(settingsFor)}
          page={settingsFor}
          onCancel={() => setSettingsFor(null)}
          onSave={(body) =>
            settingsMut.mutate({ id: Number(settingsFor.id ?? 0), body })
          }
          pending={settingsMut.isPending}
          error={settingsMut.error}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteFor)}
        title="Delete page"
        body={
          deleteFor
            ? `Delete ${deleteFor.title} and its ${Number(deleteFor.sectionCount ?? 0)} sections? Links to /${deleteFor.slug} will stop working until you publish a page with that slug.`
            : ""
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteFor(null)}
        onConfirm={() =>
          deleteFor ? deleteMut.mutate(Number(deleteFor.id ?? 0)) : undefined
        }
        disabled={deleteMut.isPending}
      />
      {patchMut.error ? <ErrorAlert error={patchMut.error} /> : null}
    </>
  );
}
