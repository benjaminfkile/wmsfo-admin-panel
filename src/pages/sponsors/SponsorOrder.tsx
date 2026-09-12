import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sponsors as sponsorsApi } from "../../api/resources/sponsors";
import { events as eventsApi } from "../../api/resources/events";
import { keys } from "../../queries/keys";
import CommentBox from "../../components/CommentBox";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import type { SponsorOrderRow } from "../../api/types";

// Sponsor order page (admin.md 6.6). One list per year in the exact
// order the site will show. Pinned rows sit on top and reorder with
// drag; the rest is by amount descending. Every reorder, pin, or
// unpin sends the whole pinned list via
// PUT /admin/sponsors/order/{eventYear} { pinnedSponsorIds } and
// replaces the local list with the response.
export default function SponsorOrder() {
  const qc = useQueryClient();
  const notify = useNotify();

  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const events = useMemo(() => eventsQ.data?.items ?? [], [eventsQ.data]);
  const currentYear = useMemo(() => {
    const cur = events.find((e) => e.isCurrent);
    if (cur && typeof cur.year !== "undefined" && cur.year !== null) {
      return Number(cur.year);
    }
    const years = events
      .map((e) => Number(e.year))
      .filter((y) => Number.isFinite(y));
    return years.length > 0 ? Math.max(...years) : new Date().getFullYear();
  }, [events]);

  const [year, setYear] = useState<number | null>(null);
  useEffect(() => {
    if (year === null && events.length > 0) {
      setYear(currentYear);
    }
  }, [year, events.length, currentYear]);

  const orderQ = useQuery({
    queryKey: ["sponsors", "order", year] as const,
    queryFn: () => sponsorsApi.order(Number(year)),
    enabled: year !== null,
  });

  const [rows, setRows] = useState<SponsorOrderRow[]>([]);
  useEffect(() => {
    if (orderQ.data?.items) {
      setRows(sortRows(orderQ.data.items));
    }
  }, [orderQ.data]);

  const putOrderMut = useMutation({
    mutationFn: (pinnedSponsorIds: number[]) =>
      sponsorsApi.putOrder(Number(year), pinnedSponsorIds),
    onSuccess: (res) => {
      setRows(sortRows(res.items));
      notify("Sponsor order saved");
      void qc.invalidateQueries({ queryKey: keys.sponsors });
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Save failed", "error"),
  });

  const yearMut = useMutation({
    mutationFn: (opts: {
      sponsorId: number;
      lingerMsOverride: number | null;
      row: SponsorOrderRow;
    }) => {
      const body = {
        amountDonated: toNumberOrNull(opts.row.amountDonated),
        active: true,
        canAdvertise: true,
        anonymous: false,
        pinnedPosition:
          opts.row.pinnedPosition === null ||
          opts.row.pinnedPosition === undefined
            ? null
            : Number(opts.row.pinnedPosition),
        lingerMsOverride: opts.lingerMsOverride,
      };
      return sponsorsApi.putYear(opts.sponsorId, Number(year), body);
    },
    onSuccess: () => {
      notify("Tracker time saved");
      void qc.invalidateQueries({ queryKey: ["sponsors", "order", year] });
      void orderQ.refetch();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Save failed", "error"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const pinnedIds = rows
    .filter((r) => r.pinnedPosition !== null && r.pinnedPosition !== undefined)
    .map((r) => Number(r.sponsorId));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = pinnedIds.indexOf(Number(active.id));
    const to = pinnedIds.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(pinnedIds, from, to);
    putOrderMut.mutate(next);
  };

  const pinRow = (sponsorId: number) => {
    if (pinnedIds.includes(sponsorId)) return;
    putOrderMut.mutate([...pinnedIds, sponsorId]);
  };

  const unpinRow = (sponsorId: number) => {
    if (!pinnedIds.includes(sponsorId)) return;
    putOrderMut.mutate(pinnedIds.filter((id) => id !== sponsorId));
  };

  const disabled = putOrderMut.isPending || orderQ.isFetching;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Sponsor order</Typography>
      </Stack>
      <Box sx={{ my: 2 }}>
        <Select
          size="small"
          value={year === null ? "" : String(year)}
          onChange={(e) =>
            setYear(e.target.value === "" ? null : Number(e.target.value))
          }
          data-testid="sponsor-order-year"
        >
          {yearOptions(events, currentYear).map((y) => (
            <MenuItem key={y} value={String(y)}>
              {y}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <CommentBox>
        Largest gift first unless pinned. Tracker time is the gift times the
        per-dollar rate (Settings), floored at the minimum, unless overridden
        here.
      </CommentBox>
      {orderQ.error ? <ErrorAlert error={orderQ.error} /> : null}
      {putOrderMut.error ? <ErrorAlert error={putOrderMut.error} /> : null}
      <Paper variant="outlined" sx={{ p: 1 }}>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No sponsors for this year.
          </Typography>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={pinnedIds}
              strategy={verticalListSortingStrategy}
            >
              <Stack spacing={1}>
                {rows.map((row) => (
                  <SortableSponsorRow
                    key={String(row.sponsorId)}
                    row={row}
                    disabled={disabled}
                    onPin={() => pinRow(Number(row.sponsorId))}
                    onUnpin={() => unpinRow(Number(row.sponsorId))}
                    onSaveTime={(seconds) =>
                      yearMut.mutate({
                        sponsorId: Number(row.sponsorId),
                        lingerMsOverride:
                          seconds === null ? null : seconds * 1000,
                        row,
                      })
                    }
                    saving={yearMut.isPending}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        )}
      </Paper>
    </>
  );
}

function sortRows(items: SponsorOrderRow[]): SponsorOrderRow[] {
  const pinned = items
    .filter((r) => r.pinnedPosition !== null && r.pinnedPosition !== undefined)
    .slice()
    .sort(
      (a, b) => Number(a.pinnedPosition ?? 0) - Number(b.pinnedPosition ?? 0)
    );
  const byAmount = items
    .filter(
      (r) => r.pinnedPosition === null || r.pinnedPosition === undefined
    )
    .slice()
    .sort((a, b) => {
      const aa = toNumberOrNull(a.amountDonated) ?? -1;
      const bb = toNumberOrNull(b.amountDonated) ?? -1;
      if (bb !== aa) return bb - aa;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  return [...pinned, ...byAmount];
}

function yearOptions(
  events: { year?: number | string }[],
  fallback: number
): number[] {
  const set = new Set<number>();
  for (const e of events) {
    const y = Number(e.year);
    if (Number.isFinite(y)) set.add(y);
  }
  set.add(fallback);
  return Array.from(set).sort((a, b) => b - a);
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

interface RowProps {
  row: SponsorOrderRow;
  disabled: boolean;
  saving: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onSaveTime: (seconds: number | null) => void;
}

function SortableSponsorRow({
  row,
  disabled,
  saving,
  onPin,
  onUnpin,
  onSaveTime,
}: RowProps) {
  const isPinned =
    row.pinnedPosition !== null && row.pinnedPosition !== undefined;
  const sortableId = Number(row.sponsorId);
  const sortable = useSortable({ id: sortableId, disabled: !isPinned });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
  };
  const [seconds, setSeconds] = useState(() =>
    row.lingerMsOverride === null || row.lingerMsOverride === undefined
      ? ""
      : String(Number(row.lingerMsOverride) / 1000)
  );
  useEffect(() => {
    setSeconds(
      row.lingerMsOverride === null || row.lingerMsOverride === undefined
        ? ""
        : String(Number(row.lingerMsOverride) / 1000)
    );
  }, [row.lingerMsOverride]);

  const grey = row.inSnapshot === false;
  const logoUrl = rowLogoUrl(row);
  const amount = toNumberOrNull(row.amountDonated);
  const trackerSeconds = (Number(row.lingerMs) / 1000).toFixed(1);

  const saveSeconds = () => {
    const trimmed = seconds.trim();
    if (trimmed === "") {
      onSaveTime(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || n > 600) return;
    onSaveTime(Math.round(n));
  };

  return (
    <Box
      ref={sortable.setNodeRef}
      style={style}
      data-testid={`sponsor-order-row-${row.sponsorId}`}
      data-pinned={isPinned ? "yes" : "no"}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        p: 1,
        opacity: grey ? 0.5 : 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton
          size="small"
          disabled={!isPinned || disabled}
          aria-label={`Drag ${row.name}`}
          {...sortable.attributes}
          {...sortable.listeners}
          sx={{ cursor: isPinned ? "grab" : "not-allowed" }}
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        {logoUrl ? (
          <Box
            component="img"
            src={logoUrl}
            alt={row.name ?? ""}
            sx={{ width: 32, height: 32, objectFit: "contain" }}
          />
        ) : (
          <Box sx={{ width: 32, height: 32 }} />
        )}
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body1">{row.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {amount === null ? "no amount" : `$${amount.toLocaleString()}`}
            {" · tracker "}
            {trackerSeconds} s
            {isPinned
              ? ` · pinned #${row.pinnedPosition}`
              : " · by amount"}
          </Typography>
        </Box>
        <TextField
          label="Time (s)"
          size="small"
          type="number"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
          onBlur={saveSeconds}
          disabled={saving || grey}
          inputProps={{ min: 0, max: 600, step: 1 }}
          sx={{ width: 110 }}
          data-testid={`sponsor-order-time-${row.sponsorId}`}
        />
        {grey ? (
          <Alert severity="info" icon={false} sx={{ py: 0, px: 1 }}>
            Not on the site
          </Alert>
        ) : isPinned ? (
          <IconButton
            size="small"
            onClick={onUnpin}
            disabled={disabled}
            aria-label={`Unpin ${row.name}`}
          >
            <PushPinIcon fontSize="small" />
          </IconButton>
        ) : (
          <IconButton
            size="small"
            onClick={onPin}
            disabled={disabled}
            aria-label={`Pin ${row.name}`}
          >
            <PushPinOutlinedIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}

function rowLogoUrl(row: SponsorOrderRow): string | null {
  const logo = row.logo;
  if (!logo) return null;
  const v480 = logo.variants?.["480"];
  if (typeof v480 === "string" && v480.length > 0) return v480;
  if (typeof logo.url === "string" && logo.url.length > 0) return logo.url;
  return null;
}
