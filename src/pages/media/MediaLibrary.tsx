import { useState } from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import MediaGrid, { type GridFilters } from "../../components/media/MediaGrid";
import Uploader from "../../components/media/Uploader";
import MediaDetailDrawer from "../../components/media/MediaDetailDrawer";
import type { MediaAsset } from "../../api/types";

// /media (admin.md 6.15). Uploader at the top, grid below with filters
// (kind, state, search). Clicking a card opens the detail drawer.
export default function MediaLibrary() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<GridFilters>({});
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleReady = () => {
    void qc.invalidateQueries({ queryKey: ["media"] });
  };

  const openDetail = (asset: MediaAsset) => {
    setSelected(asset);
    setDrawerOpen(true);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Media</Typography>
      <Box>
        <Uploader onReady={handleReady} />
      </Box>
      <Divider />
      <MediaGrid
        filters={filters}
        onFiltersChange={setFilters}
        onSelect={openDetail}
      />
      <MediaDetailDrawer
        asset={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Stack>
  );
}
