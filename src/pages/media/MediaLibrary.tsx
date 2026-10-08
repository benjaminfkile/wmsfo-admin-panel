import { useEffect, useState } from "react";
import { Box, Divider, Stack } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { media as mediaApi } from "../../api/resources/media";
import MediaGrid, { type GridFilters } from "../../components/media/MediaGrid";
import Uploader from "../../components/media/Uploader";
import MediaDetailDrawer from "../../components/media/MediaDetailDrawer";
import PageHeader from "../../components/layout/PageHeader";
import type { MediaAsset } from "../../api/types";
import { keys } from "../../queries/keys";

// /media (admin.md 6.15). Uploader at the top, grid below with filters
// (kind, state, search). Clicking a card opens the detail drawer; a
// `?id=<mediaId>` link opens the drawer on that asset.
export default function MediaLibrary() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const linkedId = params.get("id");
  const [filters, setFilters] = useState<GridFilters>({});
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const linked = useQuery({
    queryKey: keys.mediaAsset(linkedId ?? ""),
    queryFn: () => mediaApi.get(linkedId ?? ""),
    enabled: linkedId !== null && linkedId !== "",
  });
  const linkedAsset = linked.data ?? null;

  useEffect(() => {
    if (linkedAsset) {
      setSelected(linkedAsset);
      setDrawerOpen(true);
    }
  }, [linkedAsset]);

  const handleReady = () => {
    void qc.invalidateQueries({ queryKey: ["media"] });
  };

  const openDetail = (asset: MediaAsset) => {
    setSelected(asset);
    setDrawerOpen(true);
  };

  return (
    <Stack spacing={3}>
      <PageHeader title="Media" help="media" />
      <Box>
        <Uploader onReady={handleReady} help="media.uploader" />
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
