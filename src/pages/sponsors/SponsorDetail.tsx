import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sponsors as sponsorsApi } from "../../api/resources/sponsors";
import { keys } from "../../queries/keys";
import ConfirmDialog from "../../components/ConfirmDialog";
import ErrorAlert from "../../components/ErrorAlert";
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

  const sponsorQ = useQuery({
    queryKey: keys.sponsor(sponsorId),
    queryFn: () => sponsorsApi.get(sponsorId),
    enabled: Number.isFinite(sponsorId),
  });

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
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography variant="h4">{sponsor.name}</Typography>
        <Button color="error" onClick={() => setConfirmDelete(true)}>
          Delete sponsor
        </Button>
      </Stack>

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
            sx={{ mb: 1 }}
          >
            <Typography variant="h6">Years</Typography>
            <Button variant="contained" onClick={() => setYearDialogFor("new")}>
              Add year
            </Button>
          </Stack>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Event year</TableCell>
                  <TableCell align="right">Amount donated</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>Can advertise</TableCell>
                  <TableCell>Anonymous</TableCell>
                  <TableCell>Tracker time</TableCell>
                  <TableCell>Pinned</TableCell>
                  <TableCell>Registered</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {years.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary">
                        No years yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  years.map((y) => (
                    <TableRow
                      key={String(y.eventYear)}
                      data-testid={`sponsor-year-${y.eventYear}`}
                    >
                      <TableCell>{String(y.eventYear)}</TableCell>
                      <TableCell align="right">
                        {y.amountDonated === null || y.amountDonated === undefined
                          ? "none"
                          : String(y.amountDonated)}
                      </TableCell>
                      <TableCell>{y.active ? "yes" : "no"}</TableCell>
                      <TableCell>{y.canAdvertise ? "yes" : "no"}</TableCell>
                      <TableCell>{y.anonymous ? "yes" : "no"}</TableCell>
                      <TableCell>
                        {trackerTimeCell(y)}
                      </TableCell>
                      <TableCell>
                        {y.pinnedPosition === null ||
                        y.pinnedPosition === undefined
                          ? "no"
                          : `#${y.pinnedPosition}`}
                      </TableCell>
                      <TableCell>{formatMt(y.registeredAt) || "none"}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${String(y.eventYear)}`}
                          onClick={() => setYearDialogFor(y)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={`Actions for ${String(y.eventYear)}`}
                          onClick={(ev) =>
                            setYearMenuAnchor({
                              el: ev.currentTarget,
                              year: y,
                            })
                          }
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
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

      <ConfirmDialog
        open={confirmDelete}
        title="Delete sponsor?"
        body={`Delete ${sponsor.name ?? "this sponsor"}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        disabled={deleteMut.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMut.mutate()}
      />
    </Stack>
  );
}
