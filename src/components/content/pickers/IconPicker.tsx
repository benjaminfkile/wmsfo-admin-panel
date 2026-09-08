import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Tab,
  Tabs,
  TextField,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { icons as iconsApi } from "../../../api/resources/icons";
import { keys } from "../../../queries/keys";
import MediaGrid, { type GridFilters } from "../../media/MediaGrid";
import type { Icon, IconInfo, MediaAsset } from "../../../api/types";

interface Props {
  open: boolean;
  onCancel: () => void;
  onPick: (value: Icon) => void;
}

// The icon picker (admin.md 6.14 IconField). Library icons on the first
// tab, uploaded svg assets on the second. Selecting emits an `Icon`.
export default function IconPicker({ open, onCancel, onPick }: Props) {
  const [tab, setTab] = useState<"library" | "media">("library");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<GridFilters>({});

  const iconsQ = useQuery({
    queryKey: keys.icons,
    queryFn: () => iconsApi.list(),
    enabled: open,
  });

  const items: IconInfo[] = iconsQ.data?.items ?? [];
  const filtered = query
    ? items.filter(
        (i) =>
          (i.name ?? "").toLowerCase().includes(query.toLowerCase()) ||
          (i.tags ?? []).some((t) => t.toLowerCase().includes(query.toLowerCase()))
      )
    : items;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Choose an icon</DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, v: "library" | "media") => setTab(v)}
        sx={{ px: 3 }}
      >
        <Tab label="Library" value="library" />
        <Tab label="Uploaded SVG" value="media" />
      </Tabs>
      <DialogContent dividers>
        {tab === "library" ? (
          <Box>
            <TextField
              size="small"
              label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            <Grid container spacing={1}>
              {filtered.map((icon) => (
                <Grid key={icon.id}>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      onPick({ source: "library", id: icon.id ?? "" })
                    }
                    data-testid={`icon-library-${icon.id}`}
                  >
                    {icon.name}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : (
          <MediaGrid
            filters={filters}
            onFiltersChange={setFilters}
            onSelect={(asset: MediaAsset) =>
              onPick({ source: "media", id: asset.id ?? "" })
            }
            fixedKind="svg"
            fixedState="ready"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
