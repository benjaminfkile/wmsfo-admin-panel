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
import { media as mediaApi, type MediaQuery } from "../../api/resources/media";
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
  showFilters?: boolean;
  emptyText?: string;
}

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
  showFilters = true,
  emptyText = "No media",
}: Props) {
  const [searchInput, setSearchInput] = useState(filters.q ?? "");
  const effective: MediaQuery = {
    kind: fixedKind ?? filters.kind,
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

  const items: MediaAsset[] = (query.data?.pages ?? []).flatMap(
    (p) => p.items ?? []
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
          {fixedKind === undefined ? (
            <TextField
              select
              size="small"
              label="Kind"
              value={filters.kind ?? ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  kind:
                    (e.target.value as MediaQuery["kind"]) ||
                    undefined,
                })
              }
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All kinds</MenuItem>
              <MenuItem value="raster">Raster</MenuItem>
              <MenuItem value="svg">SVG</MenuItem>
              <MenuItem value="gif">GIF</MenuItem>
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
              sx={{ minWidth: 140 }}
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
