import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { events as eventsApi } from "../../api/resources/events";
import { cookieTypes as cookieTypesApi } from "../../api/resources/cookieTypes";
import { ApiError } from "../../api/errors";
import { keys } from "../../queries/keys";
import { useNotify } from "../../hooks/useNotify";
import { useCompact } from "../../hooks/useCompact";
import ErrorAlert from "../../components/ErrorAlert";
import ConfirmDialog from "../../components/ConfirmDialog";
import IconPreview from "../../components/content/IconPreview";
import { SEED_COOKIES_LABELS } from "../../components/content/labels";
import type { CookiePick, Event, Icon } from "../../api/types";

const SEED_MAX = 100;

// Clamps a typed or stepped count to a whole number from 0 to SEED_MAX;
// anything that is not a number reads as 0.
function clampCount(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(SEED_MAX, Math.max(0, Math.trunc(v)));
}

function cookiesLabel(n: number): string {
  return n === 1 ? "1 cookie" : `${n} cookies`;
}

interface Props {
  event: Event;
}

// Seeds cookies on the live event: one count per active cookie type,
// confirmed in a dialog, posted as the types above zero. The event
// detail page renders this card only while the event's status is 3.
export default function SeedCookiesSection({ event }: Props) {
  const id = Number(event.id);
  const qc = useQueryClient();
  const notify = useNotify();
  const compact = useCompact();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const typesQ = useQuery({
    queryKey: keys.cookieTypes,
    queryFn: () => cookieTypesApi.list(),
  });
  const types = (typesQ.data?.items ?? []).filter((t) => t.active);

  const countOf = (typeId: string) => counts[typeId] ?? 0;
  const setCount = (typeId: string, v: number) =>
    setCounts((c) => ({ ...c, [typeId]: clampCount(v) }));

  const items: CookiePick[] = types
    .map((t) => ({
      cookieTypeId: Number(t.id),
      count: countOf(String(t.id)),
    }))
    .filter((i) => i.count > 0);
  const total = items.reduce((sum, i) => sum + Number(i.count), 0);

  const seedMut = useMutation({
    mutationFn: (picks: CookiePick[]) =>
      eventsApi.seedCookies(id, { items: picks }),
    onSuccess: (res, picks) => {
      const seeded =
        res?.seeded ?? picks.reduce((sum, i) => sum + Number(i.count), 0);
      notify(`Seeded ${cookiesLabel(Number(seeded))}`);
      setCounts({});
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: keys.event(id) });
      void qc.invalidateQueries({ queryKey: keys.cookieTypes });
    },
    onError: (err) => {
      setConfirmOpen(false);
      if (err instanceof ApiError && err.code === "event_not_live") {
        void qc.invalidateQueries({ queryKey: keys.event(id) });
      }
    },
  });

  const buttonSx = { width: 44, height: 44 };

  return (
    <Card data-testid="seed-cookies">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {SEED_COOKIES_LABELS.items?.label}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {SEED_COOKIES_LABELS.items?.help}
        </Typography>

        <Stack spacing={2}>
          {seedMut.error ? <ErrorAlert error={seedMut.error} /> : null}
          {typesQ.error ? <ErrorAlert error={typesQ.error} /> : null}
          {types.map((t) => {
            const typeId = String(t.id);
            const name = t.name ?? "";
            const value = countOf(typeId);
            return (
              <Stack
                key={typeId}
                direction={compact ? "column" : "row"}
                spacing={compact ? 1 : 2}
                alignItems={compact ? "stretch" : "center"}
                data-testid={`seed-row-${typeId}`}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ minWidth: 0, flexGrow: 1 }}
                >
                  {t.icon ? <IconPreview icon={t.icon as Icon} size={24} /> : null}
                  <Typography variant="body1" noWrap>
                    {name}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton
                    aria-label={`One fewer ${name}`}
                    onClick={() => setCount(typeId, value - 1)}
                    disabled={value <= 0}
                    sx={buttonSx}
                  >
                    <RemoveIcon />
                  </IconButton>
                  <TextField
                    type="number"
                    size="small"
                    value={value}
                    onChange={(e) => setCount(typeId, Number(e.target.value))}
                    slotProps={{
                      htmlInput: {
                        min: 0,
                        max: SEED_MAX,
                        step: 1,
                        "aria-label": `${name} ${SEED_COOKIES_LABELS.count?.label?.toLowerCase()}`,
                      },
                    }}
                    sx={{ width: compact ? "100%" : 96, flexGrow: compact ? 1 : 0 }}
                  />
                  <IconButton
                    aria-label={`One more ${name}`}
                    onClick={() => setCount(typeId, value + 1)}
                    disabled={value >= SEED_MAX}
                    sx={buttonSx}
                  >
                    <AddIcon />
                  </IconButton>
                </Stack>
              </Stack>
            );
          })}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="subtitle1" data-testid="seed-total">
              {cookiesLabel(total)}
            </Typography>
            <Button
              variant="contained"
              onClick={() => setConfirmOpen(true)}
              disabled={total === 0 || seedMut.isPending}
            >
              Seed
            </Button>
          </Box>
        </Stack>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        title={SEED_COOKIES_LABELS.items?.label ?? ""}
        body={`Seed ${cookiesLabel(total)} on ${event.name ?? ""}? This cannot be undone.`}
        confirmLabel="Seed"
        disabled={seedMut.isPending || total === 0}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => seedMut.mutate(items)}
      />
    </Card>
  );
}
