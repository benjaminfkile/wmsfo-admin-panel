import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
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
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sponsors as sponsorsApi } from "../../api/resources/sponsors";
import { keys } from "../../queries/keys";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import {
  toSponsorBody,
  validateSponsor,
  type SponsorErrors,
  type SponsorField,
  type SponsorInput,
} from "../../validation/sponsor";
import type { Sponsor } from "../../api/types";

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

export default function SponsorsList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const [createOpen, setCreateOpen] = useState(false);
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

  const submit = () => {
    const errs = validateSponsor(input);
    setErrors(errs);
    if (Object.keys(errs).length === 0) createMut.mutate();
  };

  const sponsors = sponsorsQ.data?.items ?? [];

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">Sponsors</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New sponsor
        </Button>
      </Stack>
      {sponsorsQ.error ? (
        <ErrorAlert error={sponsorsQ.error} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Logo</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Latest year</TableCell>
                <TableCell align="right">Years</TableCell>
                <TableCell>Website</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sponsors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      No sponsors yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sponsors.map((s) => (
                  <SponsorRow key={String(s.id)} sponsor={s} />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
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
      </Dialog>
    </>
  );
}

function SponsorRow({ sponsor }: { sponsor: Sponsor }) {
  const logoUrl = sponsorLogoUrl(sponsor);
  const years = Array.isArray(sponsor.years) ? sponsor.years : [];
  const latestYear = years.reduce<number | null>((acc, y) => {
    const yr = Number(y.eventYear);
    return Number.isFinite(yr) && (acc === null || yr > acc) ? yr : acc;
  }, null);
  return (
    <TableRow hover data-testid={`sponsor-row-${sponsor.id}`}>
      <TableCell>
        {logoUrl ? (
          <Box
            component="img"
            src={logoUrl}
            alt={sponsor.name ?? ""}
            sx={{ width: 40, height: 40, objectFit: "contain" }}
          />
        ) : (
          <Alert severity="info" icon={false} sx={{ py: 0, px: 1 }}>
            none
          </Alert>
        )}
      </TableCell>
      <TableCell>
        <RouterLink to={`/sponsors/${sponsor.id}`}>{sponsor.name}</RouterLink>
      </TableCell>
      <TableCell>
        {latestYear !== null ? String(latestYear) : "none"}
      </TableCell>
      <TableCell align="right">{years.length}</TableCell>
      <TableCell>
        {sponsor.websiteUrl ? (
          <Link href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer">
            {sponsor.websiteUrl}
          </Link>
        ) : (
          "none"
        )}
      </TableCell>
    </TableRow>
  );
}

function sponsorLogoUrl(sponsor: Sponsor): string | null {
  const logo = sponsor.logo;
  if (!logo) return null;
  const v480 = logo.variants?.["480"];
  if (typeof v480 === "string" && v480.length > 0) return v480;
  if (typeof logo.url === "string" && logo.url.length > 0) return logo.url;
  return null;
}
