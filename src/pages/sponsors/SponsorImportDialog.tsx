import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import { useQuery } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import { keys } from "../../queries/keys";
import ErrorAlert from "../../components/ErrorAlert";
import type { Sponsor, SponsorYear } from "../../api/types";

interface Props {
  open: boolean;
  sponsors: Sponsor[];
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (opts: {
    fromYear: number;
    toYear: number;
    sponsorIds: number[];
  }) => void;
}

function sponsorYears(sp: Sponsor): number[] {
  const years = Array.isArray(sp.years) ? sp.years : [];
  return years
    .map((y) => Number(y.eventYear))
    .filter((y) => Number.isFinite(y));
}

function yearAmount(sp: Sponsor, year: number): number | null {
  const years = Array.isArray(sp.years) ? sp.years : [];
  const row: SponsorYear | undefined = years.find(
    (y) => Number(y.eventYear) === year
  );
  if (!row) return null;
  const v = row.amountDonated;
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function sponsorLogoUrl(sp: Sponsor): string | null {
  const logo = sp.logo;
  if (!logo) return null;
  const v480 = logo.variants?.["480"];
  if (typeof v480 === "string" && v480.length > 0) return v480;
  if (typeof logo.url === "string" && logo.url.length > 0) return logo.url;
  return null;
}

export default function SponsorImportDialog({
  open,
  sponsors,
  submitting,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
    enabled: open,
  });

  const eventYears = useMemo(() => {
    const items = eventsQ.data?.items ?? [];
    const set = new Set<number>();
    for (const e of items) {
      const y = Number(e.year);
      if (Number.isFinite(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [eventsQ.data]);

  const currentEventYear = useMemo(() => {
    const items = eventsQ.data?.items ?? [];
    const cur = items.find((e) => e.isCurrent);
    if (cur && cur.year !== null && cur.year !== undefined) {
      const y = Number(cur.year);
      if (Number.isFinite(y)) return y;
    }
    if (eventYears.length > 0) return eventYears[0]!;
    return new Date().getFullYear();
  }, [eventsQ.data, eventYears]);

  // All years that appear in any sponsor's years[], newest first.
  const fromYears = useMemo(() => {
    const set = new Set<number>();
    for (const sp of sponsors) {
      for (const y of sponsorYears(sp)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [sponsors]);

  const [fromYear, setFromYear] = useState<number | null>(null);
  const [toYear, setToYear] = useState<number | null>(null);
  const [touched, setTouched] = useState<{ from: boolean; to: boolean }>({
    from: false,
    to: false,
  });

  useEffect(() => {
    if (!open) {
      setTouched({ from: false, to: false });
      return;
    }
    if (!touched.from) {
      setFromYear((prev) => {
        if (prev !== null && fromYears.includes(prev)) return prev;
        return fromYears[0] ?? null;
      });
    }
    if (!touched.to && eventsQ.data) {
      setToYear(currentEventYear);
    }
  }, [open, fromYears, currentEventYear, eventsQ.data, touched.from, touched.to]);

  const candidates = useMemo(() => {
    if (fromYear === null || toYear === null) return [];
    return sponsors.filter((sp) => {
      const years = sponsorYears(sp);
      return years.includes(fromYear) && !years.includes(toYear);
    });
  }, [sponsors, fromYear, toYear]);

  const [ticked, setTicked] = useState<Set<number>>(new Set());
  useEffect(() => {
    // Every candidate ticked by default whenever the selection changes.
    setTicked(new Set(candidates.map((sp) => Number(sp.id))));
  }, [candidates]);

  const toggle = (id: number) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const n = ticked.size;
  const disableSubmit =
    submitting || fromYear === null || toYear === null || n === 0;

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Import sponsors from a year</DialogTitle>
      <DialogContent>
        {error ? (
          <Box sx={{ mb: 1 }}>
            <ErrorAlert error={error} />
          </Box>
        ) : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
          >
            <FormControl fullWidth>
              <InputLabel id="import-from-year">From year</InputLabel>
              <Select
                labelId="import-from-year"
                label="From year"
                value={fromYear === null ? "" : String(fromYear)}
                onChange={(e) => {
                  setTouched((t) => ({ ...t, from: true }));
                  setFromYear(
                    e.target.value === "" ? null : Number(e.target.value)
                  );
                }}
              >
                {fromYears.map((y) => (
                  <MenuItem key={y} value={String(y)}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="import-to-year">To year</InputLabel>
              <Select
                labelId="import-to-year"
                label="To year"
                value={toYear === null ? "" : String(toYear)}
                onChange={(e) => {
                  setTouched((t) => ({ ...t, to: true }));
                  setToYear(
                    e.target.value === "" ? null : Number(e.target.value)
                  );
                }}
              >
                {eventYears.map((y) => (
                  <MenuItem key={y} value={String(y)}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {candidates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No sponsors have the from year without the to year.
            </Typography>
          ) : (
            <List
              dense
              sx={{ maxHeight: 320, overflow: "auto" }}
              data-testid="sponsor-import-candidates"
            >
              {candidates.map((sp) => {
                const id = Number(sp.id);
                const logo = sponsorLogoUrl(sp);
                const amount =
                  fromYear !== null ? yearAmount(sp, fromYear) : null;
                return (
                  <ListItem key={id} disablePadding>
                    <ListItemButton onClick={() => toggle(id)}>
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          tabIndex={-1}
                          disableRipple
                          checked={ticked.has(id)}
                          inputProps={{
                            "aria-label": `Import ${sp.name ?? "sponsor"}`,
                          }}
                        />
                      </ListItemIcon>
                      {logo ? (
                        <Box
                          component="img"
                          src={logo}
                          alt=""
                          sx={{
                            width: 32,
                            height: 32,
                            objectFit: "contain",
                            mr: 1,
                          }}
                        />
                      ) : null}
                      <ListItemText
                        primary={sp.name}
                        secondary={
                          amount === null ? "no amount" : `$${amount}`
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() =>
            fromYear !== null &&
            toYear !== null &&
            onSubmit({
              fromYear,
              toYear,
              sponsorIds: Array.from(ticked),
            })
          }
          disabled={disableSubmit}
        >
          Import {n}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
