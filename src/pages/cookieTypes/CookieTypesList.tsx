import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cookieTypes as cookieTypesApi } from "../../api/resources/cookieTypes";
import type { CookieTypeBody } from "../../api/resources/cookieTypes";
import { events as eventsApi } from "../../api/resources/events";
import { icons as iconsApi } from "../../api/resources/icons";
import { keys } from "../../queries/keys";
import { ApiError } from "../../api/errors";
import CommentBox from "../../components/CommentBox";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
import IconPicker from "../../components/content/IconPicker";
import { useNotify } from "../../hooks/useNotify";
import type { CookieType, Icon, IconInfo } from "../../api/types";

type EditState =
  | { mode: "new" }
  | { mode: "edit"; type: CookieType };

interface FormInput {
  name: string;
  sort: string;
  active: boolean;
  icon: Icon | null;
}

const EMPTY: FormInput = { name: "", sort: "0", active: true, icon: null };

function fromCookieType(t: CookieType): FormInput {
  return {
    name: t.name ?? "",
    sort: String(t.sort ?? 0),
    active: Boolean(t.active),
    icon: (t.icon as Icon | null) ?? null,
  };
}

function inUseTooltip(count: number): string {
  return `${count} cookies use this type; deactivate it instead`;
}

export default function CookieTypesList() {
  const qc = useQueryClient();
  const notify = useNotify();

  const cookieTypesQ = useQuery({
    queryKey: keys.cookieTypes,
    queryFn: () => cookieTypesApi.list(),
  });
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });
  const iconsQ = useQuery({
    queryKey: keys.icons,
    queryFn: () => iconsApi.list(),
    staleTime: Infinity,
  });

  const liveEvent = useMemo(
    () =>
      (eventsQ.data?.items ?? []).find((e) => Number(e.statusId) === 3) ??
      null,
    [eventsQ.data]
  );
  const [lockedFromServer, setLockedFromServer] = useState(false);
  const locked = liveEvent !== null || lockedFromServer;

  const [editing, setEditing] = useState<EditState | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<
    { el: HTMLElement; type: CookieType } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<CookieType | null>(null);
  const [deleteAlert, setDeleteAlert] = useState<string | null>(null);

  const setLive = () => {
    setLockedFromServer(true);
    void qc.invalidateQueries({ queryKey: keys.events });
  };

  const createMut = useMutation({
    mutationFn: (b: CookieTypeBody) => cookieTypesApi.create(b),
    onSuccess: () => {
      notify("Cookie type created");
      void qc.invalidateQueries({ queryKey: keys.cookieTypes });
      setEditing(null);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "event_live") setLive();
    },
  });
  const patchMut = useMutation({
    mutationFn: ({ id, b }: { id: number; b: Partial<CookieTypeBody> }) =>
      cookieTypesApi.patch(id, b),
    onSuccess: () => {
      notify("Cookie type saved");
      void qc.invalidateQueries({ queryKey: keys.cookieTypes });
      setEditing(null);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "event_live") setLive();
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => cookieTypesApi.remove(id),
    onSuccess: () => {
      notify("Cookie type deleted");
      void qc.invalidateQueries({ queryKey: keys.cookieTypes });
      setConfirmDelete(null);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.code === "event_live") {
          setLive();
          setConfirmDelete(null);
          return;
        }
        if (e.code === "cookie_type_in_use") {
          const count = Number(
            (e.body?.details?.["cookieCount"] as number | undefined) ?? 0
          );
          setDeleteAlert(inUseTooltip(count));
          void qc.invalidateQueries({ queryKey: keys.cookieTypes });
          setConfirmDelete(null);
          return;
        }
      }
      notify(e instanceof Error ? e.message : "Delete failed", "error");
    },
  });

  const iconsById = useMemo(() => {
    const m = new Map<string, IconInfo>();
    for (const i of iconsQ.data?.items ?? []) {
      if (typeof i.id === "string") m.set(i.id, i);
    }
    return m;
  }, [iconsQ.data]);

  const cookieTypes = cookieTypesQ.data?.items ?? [];

  const closeMenu = () => setMenuAnchor(null);

  return (
    <>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Cookie types
      </Typography>
      {locked ? (
        <CommentBox title="Locked" variant="warning">
          {`Locked: ${
            liveEvent?.name ?? "an event"
          } is live. Cookie types can be created, edited, and deactivated again after the event ends.`}
        </CommentBox>
      ) : null}
      {deleteAlert ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => setDeleteAlert(null)}
        >
          {deleteAlert}
        </Alert>
      ) : null}

      <Stack
        direction="row"
        justifyContent="flex-end"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Button
          variant="contained"
          onClick={() => setEditing({ mode: "new" })}
          disabled={locked}
          data-testid="cookie-type-new"
        >
          New type
        </Button>
      </Stack>

      {cookieTypesQ.error ? (
        <ErrorAlert error={cookieTypesQ.error} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Icon</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Sort</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Cookies</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cookieTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">
                      No cookie types yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                cookieTypes.map((t) => {
                  const count = Number(t.cookieCount ?? 0);
                  return (
                    <TableRow
                      key={String(t.id)}
                      data-testid={`cookie-type-row-${t.id}`}
                    >
                      <TableCell>
                        <IconCell icon={t.icon as Icon | null} lib={iconsById} />
                      </TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell align="right">{String(t.sort ?? 0)}</TableCell>
                      <TableCell>{t.active ? "yes" : "no"}</TableCell>
                      <TableCell align="right">{String(count)}</TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          <IconButton
                            size="small"
                            aria-label={`Edit ${t.name ?? "cookie type"}`}
                            disabled={locked}
                            onClick={() => setEditing({ mode: "edit", type: t })}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={`Actions for ${t.name ?? "cookie type"}`}
                            disabled={locked}
                            onClick={(ev) =>
                              setMenuAnchor({ el: ev.currentTarget, type: t })
                            }
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CookieTypeDialog
        open={editing !== null}
        state={editing}
        submitting={createMut.isPending || patchMut.isPending}
        error={createMut.error ?? patchMut.error}
        onCancel={() => {
          setEditing(null);
          createMut.reset();
          patchMut.reset();
        }}
        onSubmit={(body) => {
          if (!editing) return;
          if (editing.mode === "new") {
            createMut.mutate(body);
          } else {
            const id = Number(editing.type.id);
            patchMut.mutate({ id, b: body });
          }
        }}
      />

      {menuAnchor ? (
        <Menu open anchorEl={menuAnchor.el} onClose={closeMenu}>
          {(() => {
            const count = Number(menuAnchor.type.cookieCount ?? 0);
            const disabled = count > 0;
            const item = (
              <MenuItem
                disabled={disabled}
                onClick={() => {
                  setConfirmDelete(menuAnchor.type);
                  closeMenu();
                }}
              >
                Delete
              </MenuItem>
            );
            return disabled ? (
              <Tooltip title={inUseTooltip(count)} placement="left">
                <span>{item}</span>
              </Tooltip>
            ) : (
              item
            );
          })()}
        </Menu>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          open
          title="Delete cookie type?"
          body={`Delete ${confirmDelete.name}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMut.mutate(Number(confirmDelete.id))}
        />
      ) : null}
    </>
  );
}

function IconCell({
  icon,
  lib,
}: {
  icon: Icon | null;
  lib: Map<string, IconInfo>;
}) {
  if (!icon) return <>none</>;
  if (icon.source === "library") {
    const info = lib.get(String(icon.id));
    if (info?.url) {
      return (
        <Box
          component="img"
          src={info.url}
          alt={info.name ?? String(icon.id)}
          sx={{ width: 32, height: 32 }}
        />
      );
    }
    return <>{String(icon.id)}</>;
  }
  // media asset: we don't have the URL here without a media fetch.
  return <>media</>;
}

interface DialogProps {
  open: boolean;
  state: EditState | null;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (b: CookieTypeBody) => void;
}

function CookieTypeDialog({
  open,
  state,
  submitting,
  error,
  onCancel,
  onSubmit,
}: DialogProps) {
  const [input, setInput] = useState<FormInput>(EMPTY);
  const [errors, setErrors] = useState<{ name?: string; sort?: string; icon?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (state?.mode === "edit") setInput(fromCookieType(state.type));
    else setInput(EMPTY);
    setErrors({});
  }, [open, state]);

  const submit = () => {
    const errs: { name?: string; sort?: string; icon?: string } = {};
    const name = input.name.trim();
    const sort = Number(input.sort);
    if (name.length < 1 || name.length > 100) errs.name = "1 to 100 characters";
    if (
      !Number.isFinite(sort) ||
      !Number.isInteger(sort) ||
      sort < -1000 ||
      sort > 1000
    )
      errs.sort = "Whole number between -1000 and 1000";
    if (!input.icon) errs.icon = "Choose an icon";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({
      name,
      sort,
      active: input.active,
      icon: input.icon,
    });
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{state?.mode === "edit" ? "Edit cookie type" : "New cookie type"}</DialogTitle>
      <DialogContent>
        {error ? <ErrorAlert error={error} /> : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={input.name}
            onChange={(e) => setInput({ ...input, name: e.target.value })}
            error={Boolean(errors.name)}
            helperText={errors.name ?? " "}
            required
            fullWidth
          />
          <TextField
            label="Sort"
            type="number"
            value={input.sort}
            onChange={(e) => setInput({ ...input, sort: e.target.value })}
            error={Boolean(errors.sort)}
            helperText={errors.sort ?? " "}
            required
            fullWidth
          />
          <FormControlLabel
            label="Active"
            control={
              <Switch
                checked={input.active}
                onChange={(_, v) => setInput({ ...input, active: v })}
              />
            }
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">Icon:</Typography>
            <Typography variant="body2" color="text.secondary">
              {input.icon
                ? `${input.icon.source}:${input.icon.id}`
                : "none"}
            </Typography>
            <Button onClick={() => setPickerOpen(true)}>Choose</Button>
            {input.icon ? (
              <Button
                color="error"
                onClick={() => setInput({ ...input, icon: null })}
              >
                Clear
              </Button>
            ) : null}
          </Stack>
          {errors.icon ? (
            <Typography color="error" variant="caption">
              {errors.icon}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={submitting}>
          Save
        </Button>
      </DialogActions>
      <IconPicker
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onPick={(icon) => {
          setInput({ ...input, icon });
          setPickerOpen(false);
        }}
      />
    </Dialog>
  );
}
