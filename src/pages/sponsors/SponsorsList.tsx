import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  TextField,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sponsors as sponsorsApi } from "../../api/resources/sponsors";
import { keys } from "../../queries/keys";
import AppDialog from "../../components/AppDialog";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { useNotify } from "../../hooks/useNotify";
import {
  toSponsorBody,
  validateSponsor,
  type SponsorErrors,
  type SponsorField,
  type SponsorInput,
} from "../../validation/sponsor";
import type { Sponsor } from "../../api/types";
import SponsorImportDialog from "./SponsorImportDialog";

const EMPTY_INPUT: SponsorInput = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  websiteUrl: "",
  fbUrl: "",
  igUrl: "",
};

const OPTIONAL_FIELDS: { key: SponsorField; label: string }[] = [
  { key: "contactPerson", label: "Contact person" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "websiteUrl", label: "Website URL" },
  { key: "fbUrl", label: "Facebook URL" },
  { key: "igUrl", label: "Instagram URL" },
];

function sponsorLogoUrl(sponsor: Sponsor): string | null {
  const logo = sponsor.logo;
  if (!logo) return null;
  const v480 = logo.variants?.["480"];
  if (typeof v480 === "string" && v480.length > 0) return v480;
  if (typeof logo.url === "string" && logo.url.length > 0) return logo.url;
  return null;
}

function latestYearOf(sponsor: Sponsor): number | null {
  const years = Array.isArray(sponsor.years) ? sponsor.years : [];
  return years.reduce<number | null>((acc, y) => {
    const yr = Number(y.eventYear);
    return Number.isFinite(yr) && (acc === null || yr > acc) ? yr : acc;
  }, null);
}

export default function SponsorsList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [input, setInput] = useState<SponsorInput>(EMPTY_INPUT);
  const [errors, setErrors] = useState<SponsorErrors>({});

  const sponsorsQ = useQuery({
    queryKey: keys.sponsors,
    queryFn: () => sponsorsApi.list(),
  });

  const createMut = useMutation({
    mutationFn: () => {
      const body = toSponsorBody(input);
      return sponsorsApi.create({ ...body, name: body.name ?? "" });
    },
    onSuccess: (created) => {
      notify("Sponsor created");
      void qc.invalidateQueries({ queryKey: keys.sponsors });
      setCreateOpen(false);
      setInput(EMPTY_INPUT);
      setErrors({});
      if (created.id !== undefined && created.id !== null) {
        navigate(`/sponsors/${created.id}`);
      }
    },
  });

  const importMut = useMutation({
    mutationFn: (opts: {
      fromYear: number;
      toYear: number;
      sponsorIds: number[];
    }) =>
      sponsorsApi.importFromYear(opts.fromYear, opts.toYear, opts.sponsorIds),
    onSuccess: (res) => {
      const created = Number(res.created ?? 0);
      const skipped = Number(res.skipped ?? 0);
      notify(`Imported ${created}, skipped ${skipped}`);
      void qc.invalidateQueries({ queryKey: keys.sponsors });
      setImportOpen(false);
    },
  });

  const submit = () => {
    const errs = validateSponsor(input);
    setErrors(errs);
    if (Object.keys(errs).length === 0) createMut.mutate();
  };

  const sponsors = sponsorsQ.data?.items ?? [];

  const columns: Column<Sponsor>[] = [
    {
      key: "name",
      header: "Name",
      role: "title",
      render: (s) => (
        <RouterLink to={`/sponsors/${s.id}`}>{s.name}</RouterLink>
      ),
    },
    {
      key: "latestYear",
      header: "Latest year",
      role: "line",
      render: (s) => {
        const y = latestYearOf(s);
        return y !== null ? String(y) : "none";
      },
    },
    {
      key: "years",
      header: "Years",
      align: "right",
      role: "line",
      render: (s) => String((s.years ?? []).length),
    },
    {
      key: "website",
      header: "Website",
      role: "line",
      render: (s) =>
        s.websiteUrl ? (
          <Link
            href={s.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {s.websiteUrl}
          </Link>
        ) : (
          "none"
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Sponsors"
        actions={
          <>
            <Button variant="outlined" onClick={() => setImportOpen(true)}>
              Import from year
            </Button>
            <Button variant="contained" onClick={() => setCreateOpen(true)}>
              New sponsor
            </Button>
          </>
        }
      />
      {sponsorsQ.error ? (
        <ErrorAlert error={sponsorsQ.error} />
      ) : (
        <ResponsiveTable<Sponsor>
          rows={sponsors}
          columns={columns}
          rowKey={(s) => String(s.id)}
          rowTestId={(s) => `sponsor-row-${s.id}`}
          emptyText="No sponsors yet."
          leading={(s) => {
            const url = sponsorLogoUrl(s);
            return url ? (
              <Box
                component="img"
                src={url}
                alt={s.name ?? ""}
                sx={{ width: 40, height: 40, objectFit: "contain" }}
              />
            ) : (
              <Alert severity="info" icon={false} sx={{ py: 0, px: 1 }}>
                none
              </Alert>
            );
          }}
          actions={(s) => (
            <IconButton
              size="small"
              component={RouterLink}
              to={`/sponsors/${s.id}`}
              aria-label={`Edit ${s.name ?? "sponsor"}`}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          audit={(s) => ({
            entity: "sponsor",
            entityId: s.id ?? "",
            name: s.name ?? "sponsor",
            audit: s.audit,
          })}
        />
      )}

      <AppDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setInput(EMPTY_INPUT);
          setErrors({});
          createMut.reset();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>New sponsor</DialogTitle>
        <DialogContent>
          {createMut.error ? (
            <Box sx={{ mb: 1 }}>
              <ErrorAlert error={createMut.error} />
            </Box>
          ) : null}
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
            {OPTIONAL_FIELDS.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                value={input[f.key]}
                onChange={(e) =>
                  setInput({ ...input, [f.key]: e.target.value })
                }
                error={Boolean(errors[f.key])}
                helperText={errors[f.key] ?? " "}
                fullWidth
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={createMut.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </AppDialog>

      <SponsorImportDialog
        open={importOpen}
        sponsors={sponsors}
        submitting={importMut.isPending}
        error={importMut.error}
        onCancel={() => {
          setImportOpen(false);
          importMut.reset();
        }}
        onSubmit={(opts) => importMut.mutate(opts)}
      />
    </>
  );
}
