import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sponsors as sponsorsApi } from "../../api/resources/sponsors";
import { events as eventsApi } from "../../api/resources/events";
import { keys } from "../../queries/keys";
import AppDialog from "../../components/AppDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import DeleteDialog from "../../components/DeleteDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { ApiError } from "../../api/errors";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import {
  toSponsorBody,
  validateSponsor,
  type SponsorErrors,
  type SponsorField,
  type SponsorInput,
} from "../../validation/sponsor";
import type { Sponsor, SponsorYear } from "../../api/types";
import SponsorYearDialog from "./SponsorYearDialog";
import LogoSection from "./LogoSection";

function trackerTimeCell(y: SponsorYear): string {
  const linger = y.lingerMs;
  const seconds =
    linger === null || linger === undefined
      ? "unknown"
      : `${(Number(linger) / 1000).toFixed(1)} s`;
  const override =
    y.lingerMsOverride !== null && y.lingerMsOverride !== undefined
      ? " (override)"
      : "";
  return `${seconds}${override}`;
}

const FIELDS: { key: SponsorField; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "contactPerson", label: "Contact person" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "websiteUrl", label: "Website URL" },
  { key: "fbUrl", label: "Facebook URL" },
  { key: "igUrl", label: "Instagram URL" },
];

function fromSponsor(s: Sponsor | undefined): SponsorInput {
  return {
    name: s?.name ?? "",
    contactPerson: s?.contactPerson ?? "",
    email: s?.email ?? "",
    phone: s?.phone ?? "",
    address: s?.address ?? "",
    websiteUrl: s?.websiteUrl ?? "",
    fbUrl: s?.fbUrl ?? "",
    igUrl: s?.igUrl ?? "",
  };
}

export default function SponsorDetail() {
  const { id } = useParams();
  const sponsorId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();

  const [input, setInput] = useState<SponsorInput>(fromSponsor(undefined));
  const [errors, setErrors] = useState<SponsorErrors>({});
  const [yearDialogFor, setYearDialogFor] = useState<SponsorYear | "new" | null>(
    null
  );
  const [confirmDeleteYear, setConfirmDeleteYear] =
    useState<SponsorYear | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [yearMenuAnchor, setYearMenuAnchor] = useState<{
    el: HTMLElement;
    year: SponsorYear;
  } | null>(null);
  const [copyFromAnchor, setCopyFromAnchor] = useState<HTMLElement | null>(
    null
  );
  const [copyPrompt, setCopyPrompt] = useState<{
    sourceYear: number;
    targetYear: string;
  } | null>(null);

  const sponsorQ = useQuery({
    queryKey: keys.sponsor(sponsorId),
    queryFn: () => sponsorsApi.get(sponsorId),
    enabled: Number.isFinite(sponsorId),
  });

  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const currentEventYear = useMemo(() => {
    const items = eventsQ.data?.items ?? [];
    const cur = items.find((e) => e.isCurrent);
    if (cur && cur.year !== null && cur.year !== undefined) {
      const y = Number(cur.year);
      if (Number.isFinite(y)) return y;
    }
    return new Date().getFullYear();
  }, [eventsQ.data]);

  useEffect(() => {
    if (sponsorQ.data) setInput(fromSponsor(sponsorQ.data));
  }, [sponsorQ.data]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.sponsor(sponsorId) });
    void qc.invalidateQueries({ queryKey: keys.sponsors });
  };

  const setSponsorData = (s: Sponsor) => {
    qc.setQueryData(keys.sponsor(sponsorId), s);
  };

  const patchMut = useMutation({
    mutationFn: (body: Record<string, string | null>) =>
      sponsorsApi.patch(sponsorId, body),
    onSuccess: (s) => {
      notify("Sponsor saved");
      setSponsorData(s);
      invalidate();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Save failed", "error"),
  });

  const [pickerOpen, setPickerOpen] = useState(false);

  const logoMut = useMutation({
    mutationFn: (logoMediaId: string | null) =>
      sponsorsApi.patch(sponsorId, { logoMediaId }),
    onSuccess: (s) => {
      notify("Logo updated");
      setSponsorData(s);
      invalidate();
      setPickerOpen(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "media_not_ready") {
        notify("Media not ready. Choose again.", "warning");
        // Reopen the picker (admin.md 6.6, 8.2 media_not_ready).
        setPickerOpen(true);
      } else {
        notify(e instanceof Error ? e.message : "Logo update failed", "error");
      }
    },
  });

  const yearMut = useMutation({
    mutationFn: ({
      eventYear,
      body,
    }: {
      eventYear: number;
      body: {
        amountDonated: number | null;
        active: boolean;
        canAdvertise: boolean;
        anonymous: boolean;
        pinnedPosition: number | null;
        lingerMsOverride: number | null;
      };
    }) => sponsorsApi.putYear(sponsorId, eventYear, body),
    onSuccess: (s) => {
      notify("Year saved");
      setSponsorData(s);
      invalidate();
      setYearDialogFor(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Save failed", "error"),
  });

  const deleteYearMut = useMutation({
    mutationFn: (eventYear: number) =>
      sponsorsApi.deleteYear(sponsorId, eventYear),
    onSuccess: () => {
      notify("Year deleted");
      invalidate();
      setConfirmDeleteYear(null);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const copyYearMut = useMutation({
    mutationFn: (opts: { sourceYear: number; targetYear: number }) =>
      sponsorsApi.copyYearFrom(sponsorId, opts.targetYear, opts.sourceYear),
    onSuccess: (created) => {
      notify("Year added");
      setCopyPrompt(null);
      // Refetch so the years table shows the new row before we open
      // its edit dialog.
      void qc.invalidateQueries({ queryKey: keys.sponsors });
      void qc
        .invalidateQueries({ queryKey: keys.sponsor(sponsorId) })
        .then(() => setYearDialogFor(created));
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => sponsorsApi.remove(sponsorId),
    onSuccess: () => {
      notify("Sponsor deleted");
      void qc.invalidateQueries({ queryKey: keys.sponsors });
      navigate("/sponsors");
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  const submitDetails = () => {
    const errs = validateSponsor(input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const body = toSponsorBody(input);
    // Send only changed fields
    const current = fromSponsor(sponsorQ.data);
    const changed: Record<string, string | null> = {};
    (Object.keys(body) as SponsorField[]).forEach((k) => {
      if ((current[k] ?? "").trim() !== (input[k] ?? "").trim()) {
        changed[k] = body[k];
      }
    });
    if (Object.keys(changed).length === 0) {
      notify("No changes");
      return;
    }
    patchMut.mutate(changed);
  };

  if (sponsorQ.isLoading) {
    return <Typography>Loading…</Typography>;
  }
  if (sponsorQ.error) {
    return <ErrorAlert error={sponsorQ.error} />;
  }
  const sponsor = sponsorQ.data;
  if (!sponsor) return null;
  const years = Array.isArray(sponsor.years) ? sponsor.years : [];

  return (
    <Stack spacing={3}>
      <PageHeader
        title={sponsor.name ?? "Sponsor"}
        actions={
          <Button color="error" onClick={() => setConfirmDelete(true)}>
            Delete sponsor
          </Button>
        }
      />

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Details
          </Typography>
          {patchMut.error ? <ErrorAlert error={patchMut.error} /> : null}
          <Stack spacing={2} sx={{ mt: 1 }}>
            {FIELDS.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                value={input[f.key]}
                onChange={(e) =>
                  setInput({ ...input, [f.key]: e.target.value })
                }
                error={Boolean(errors[f.key])}
                helperText={errors[f.key] ?? " "}
                required={f.required}
                fullWidth
              />
            ))}
            <Box>
              <Button
                variant="contained"
                onClick={submitDetails}
                disabled={patchMut.isPending}
              >
                Save
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <LogoSection
        sponsor={sponsor}
        disabled={logoMut.isPending}
        pickerOpen={pickerOpen}
        onOpenPicker={() => setPickerOpen(true)}
        onClosePicker={() => setPickerOpen(false)}
        onPick={(asset) => {
          if (typeof asset.id === "string") {
            logoMut.mutate(asset.id);
          }
        }}
        onRemove={() => logoMut.mutate(null)}
      />

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ mb: 1 }}
          >
            <Typography variant="h6">Years</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Button
                variant="outlined"
                disabled={years.length === 0}
                onClick={(e) => setCopyFromAnchor(e.currentTarget)}
              >
                Add year from…
              </Button>
              <Button variant="contained" onClick={() => setYearDialogFor("new")}>
                Add year
              </Button>
            </Stack>
          </Stack>
          <YearsTable
            years={years}
            onEdit={(y) => setYearDialogFor(y)}
            onMenu={(y, el) => setYearMenuAnchor({ el, year: y })}
          />
        </CardContent>
      </Card>

      <SponsorYearDialog
        open={yearDialogFor !== null}
        edit={yearDialogFor === "new" ? null : yearDialogFor}
        submitting={yearMut.isPending}
        error={yearMut.error}
        onCancel={() => {
          setYearDialogFor(null);
          yearMut.reset();
        }}
        onSubmit={(eventYear, body) => yearMut.mutate({ eventYear, body })}
      />

      {yearMenuAnchor ? (
        <Menu
          open
          anchorEl={yearMenuAnchor.el}
          onClose={() => setYearMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setConfirmDeleteYear(yearMenuAnchor.year);
              setYearMenuAnchor(null);
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      ) : null}

      {copyFromAnchor ? (
        <Menu
          open
          anchorEl={copyFromAnchor}
          onClose={() => setCopyFromAnchor(null)}
        >
          {years
            .slice()
            .sort((a, b) => Number(b.eventYear) - Number(a.eventYear))
            .map((y) => (
              <MenuItem
                key={String(y.eventYear)}
                onClick={() => {
                  setCopyFromAnchor(null);
                  copyYearMut.reset();
                  setCopyPrompt({
                    sourceYear: Number(y.eventYear),
                    targetYear: String(currentEventYear),
                  });
                }}
              >
                {String(y.eventYear)}
              </MenuItem>
            ))}
        </Menu>
      ) : null}

      <CopyYearPrompt
        prompt={copyPrompt}
        submitting={copyYearMut.isPending}
        error={copyYearMut.error}
        onCancel={() => {
          setCopyPrompt(null);
          copyYearMut.reset();
        }}
        onChange={(targetYear) =>
          copyPrompt && setCopyPrompt({ ...copyPrompt, targetYear })
        }
        onSubmit={() => {
          if (!copyPrompt) return;
          const target = Number(copyPrompt.targetYear);
          if (!Number.isInteger(target) || target < 2000 || target > 2100) {
            return;
          }
          copyYearMut.mutate({
            sourceYear: copyPrompt.sourceYear,
            targetYear: target,
          });
        }}
      />

      <ConfirmDialog
        open={confirmDeleteYear !== null}
        title="Delete year?"
        body={
          confirmDeleteYear
            ? `Delete the ${String(confirmDeleteYear.eventYear)} row? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        disabled={deleteYearMut.isPending}
        onCancel={() => setConfirmDeleteYear(null)}
        onConfirm={() =>
          confirmDeleteYear &&
          deleteYearMut.mutate(Number(confirmDeleteYear.eventYear))
        }
      />

      {confirmDelete ? (
        <DeleteDialog
          open
          resource="sponsors"
          id={sponsorId}
          name={sponsor.name ?? "sponsor"}
          disabled={deleteMut.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteMut.mutate()}
        />
      ) : null}
    </Stack>
  );
}

interface YearsTableProps {
  years: SponsorYear[];
  onEdit: (y: SponsorYear) => void;
  onMenu: (y: SponsorYear, el: HTMLElement) => void;
}

function YearsTable({ years, onEdit, onMenu }: YearsTableProps) {
  const columns: Column<SponsorYear>[] = [
    {
      key: "eventYear",
      header: "Event year",
      role: "title",
      render: (y) => String(y.eventYear),
    },
    {
      key: "active",
      header: "Active",
      role: "chip",
      render: (y) => (
        <Chip
          size="small"
          label="Active"
          color={y.active ? "success" : "default"}
          variant={y.active ? "filled" : "outlined"}
        />
      ),
      renderCompact: (y) =>
        y.active ? (
          <Chip size="small" label="Active" color="success" />
        ) : null,
    },
    {
      key: "canAdvertise",
      header: "Can advertise",
      role: "chip",
      render: (y) => (
        <Chip
          size="small"
          label="Can advertise"
          color={y.canAdvertise ? "primary" : "default"}
          variant={y.canAdvertise ? "filled" : "outlined"}
        />
      ),
      renderCompact: (y) =>
        y.canAdvertise ? (
          <Chip size="small" label="Can advertise" color="primary" />
        ) : null,
    },
    {
      key: "anonymous",
      header: "Anonymous",
      role: "chip",
      render: (y) => (
        <Chip
          size="small"
          label="Anonymous"
          color={y.anonymous ? "warning" : "default"}
          variant={y.anonymous ? "filled" : "outlined"}
        />
      ),
      renderCompact: (y) =>
        y.anonymous ? (
          <Chip size="small" label="Anonymous" color="warning" />
        ) : null,
    },
    {
      key: "amountDonated",
      header: "Amount donated",
      align: "right",
      label: "Amount",
      role: "line",
      render: (y) =>
        y.amountDonated === null || y.amountDonated === undefined
          ? "none"
          : String(y.amountDonated),
    },
    {
      key: "trackerTime",
      header: "Tracker time",
      role: "line",
      render: (y) => trackerTimeCell(y),
    },
    {
      key: "pinned",
      header: "Pinned",
      role: "line",
      render: (y) =>
        y.pinnedPosition === null || y.pinnedPosition === undefined
          ? "no"
          : `#${y.pinnedPosition}`,
    },
    {
      key: "registered",
      header: "Registered",
      role: "line",
      render: (y) => formatMt(y.registeredAt) || "none",
    },
  ];

  return (
    <ResponsiveTable<SponsorYear>
      rows={years}
      columns={columns}
      rowKey={(y) => String(y.eventYear)}
      rowTestId={(y) => `sponsor-year-${y.eventYear}`}
      emptyText="No years yet."
      actions={(y) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <IconButton
            size="small"
            aria-label={`Edit ${String(y.eventYear)}`}
            onClick={() => onEdit(y)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label={`Actions for ${String(y.eventYear)}`}
            onClick={(ev) => onMenu(y, ev.currentTarget)}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
      audit={(y) => ({
        entity: "sponsor_year",
        entityId: String(y.eventYear),
        name: `sponsor year ${y.eventYear ?? ""}`,
        audit: null,
      })}
    />
  );
}

interface CopyPromptProps {
  prompt: { sourceYear: number; targetYear: string } | null;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onChange: (targetYear: string) => void;
  onSubmit: () => void;
}

function CopyYearPrompt({
  prompt,
  submitting,
  error,
  onCancel,
  onChange,
  onSubmit,
}: CopyPromptProps) {
  const yearExists =
    error instanceof ApiError && error.code === "year_exists";
  const raw = prompt?.targetYear ?? "";
  const parsed = raw.trim() === "" ? NaN : Number(raw);
  const rangeError =
    raw.trim() !== "" &&
    (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100)
      ? "Year must be between 2000 and 2100"
      : null;
  const helper = yearExists
    ? "The sponsor already has this year."
    : (rangeError ?? " ");
  return (
    <AppDialog open={prompt !== null} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Copy year</DialogTitle>
      <DialogContent>
        {error && !yearExists ? <ErrorAlert error={error} /> : null}
        <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>
          {prompt
            ? `Copy from ${String(prompt.sourceYear)} to a new year:`
            : ""}
        </Typography>
        <TextField
          label="Target year"
          type="number"
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          error={yearExists || rangeError !== null}
          helperText={helper}
          inputProps={{ min: 2000, max: 2100, step: 1 }}
          autoFocus
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={submitting || rangeError !== null || raw.trim() === ""}
        >
          Copy
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
