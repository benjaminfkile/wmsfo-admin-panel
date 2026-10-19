import { useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  media as mediaApi,
  type MediaKind,
  type MediaQuery,
} from "../../api/resources/media";
import { keys } from "../../queries/keys";
import ErrorAlert from "../ErrorAlert";
import type { MediaAsset } from "../../api/types";
import MediaCard from "./MediaCard";

export type GridFilters = {
  kind?: MediaQuery["kind"];
  state?: MediaQuery["state"];
  q?: string;
};

interface Props {
  filters: GridFilters;
  onFiltersChange: (next: GridFilters) => void;
  onSelect?: (asset: MediaAsset) => void;
  selectedId?: string | null;
  // Filters that callers force (MediaPicker fixes state=ready and passes kind).
  fixedKind?: MediaQuery["kind"];
  fixedState?: MediaQuery["state"];
  // The kinds the grid offers (MediaPicker passes images, or images plus
  // video); absent offers every kind. The kind filter lists only these,
  // and an asset of another kind never shows.
  kinds?: MediaKind[];
  // Assets left out of the grid (the drawer's own asset when choosing
  // its dark mode version).
  excludeIds?: string[];
  showFilters?: boolean;
  emptyText?: string;
}

const KIND_OPTIONS: { value: MediaKind; label: string }[] = [
  { value: "raster", label: "Raster" },
  { value: "svg", label: "SVG" },
  { value: "gif", label: "GIF" },
  { value: "video", label: "Video" },
];

// The library grid backed by keys.media(q) as an infinite query
// (admin.md 6.15). Filters live above the grid; the caller can freeze
// any of them.
export default function MediaGrid({
  filters,
  onFiltersChange,
  onSelect,
  selectedId,
  fixedKind,
  fixedState,
  kinds,
  excludeIds,
  showFilters = true,
  emptyText = "No media",
}: Props) {
  const [searchInput, setSearchInput] = useState(filters.q ?? "");
  const offered = kinds ?? KIND_OPTIONS.map((o) => o.value);
  const pickedKind =
    filters.kind !== undefined && offered.includes(filters.kind)
      ? filters.kind
      : undefined;
  // The API filters one kind at a time; with several kinds offered and
  // none picked the grid asks for every kind and drops the others here.
  const effective: MediaQuery = {
    kind: fixedKind ?? pickedKind ?? (offered.length === 1 ? offered[0] : undefined),
    state: fixedState ?? filters.state,
    q: filters.q,
    limit: 50,
  };
  const query = useInfiniteQuery({
    queryKey: keys.media(effective),
    queryFn: ({ pageParam }) =>
      mediaApi.list({ ...effective, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items: MediaAsset[] = (query.data?.pages ?? []).flatMap((p) =>
    (p.items ?? []).filter(
      (a) =>
        !excludeIds?.includes(a.id ?? "") &&
        (fixedKind !== undefined ||
          kinds === undefined ||
          typeof a.kind !== "string" ||
          kinds.includes(a.kind as MediaKind))
    )
  );

  return (
    <Stack spacing={2}>
      {showFilters ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            label="Search"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onFiltersChange({
                  ...filters,
                  q: searchInput.trim() || undefined,
                });
              }
            }}
            onBlur={() =>
              onFiltersChange({
                ...filters,
                q: searchInput.trim() || undefined,
              })
            }
            fullWidth
          />
          {fixedKind === undefined && offered.length > 1 ? (
            <TextField
              select
              size="small"
              label="Kind"
              value={pickedKind ?? ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  kind:
                    (e.target.value as MediaQuery["kind"]) ||
                    undefined,
                })
              }
              sx={{ minWidth: { xs: "100%", sm: 140 } }}
            >
              <MenuItem value="">All kinds</MenuItem>
              {KIND_OPTIONS.filter((o) => offered.includes(o.value)).map(
                (o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                )
              )}
            </TextField>
          ) : null}
          {fixedState === undefined ? (
            <TextField
              select
              size="small"
              label="State"
              value={filters.state ?? ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  state:
                    (e.target.value as MediaQuery["state"]) ||
                    undefined,
                })
              }
              sx={{ minWidth: { xs: "100%", sm: 140 } }}
            >
              <MenuItem value="">All states</MenuItem>
              <MenuItem value="ready">Ready</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="orphaned">Orphaned</MenuItem>
            </TextField>
          ) : null}
        </Stack>
      ) : null}
      {query.error ? (
        <ErrorAlert error={query.error} />
      ) : query.isLoading ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
              md: "repeat(4, 1fr)",
              lg: "repeat(5, 1fr)",
            },
          }}
          data-testid="media-grid"
        >
          {items.map((asset) => (
            <MediaCard
              key={asset.id}
              asset={asset}
              onClick={onSelect ? () => onSelect(asset) : undefined}
              selected={selectedId === asset.id}
            />
          ))}
        </Box>
      )}
      {query.hasNextPage ? (
        <Box sx={{ textAlign: "center" }}>
          <Button
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}
