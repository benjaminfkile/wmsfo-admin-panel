import { useEffect, useState } from "react";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import type { MediaAsset } from "../../api/types";
import {
  IMAGE_KINDS,
  type MediaKind,
  type MediaQuery,
} from "../../api/resources/media";
import AppDialog from "../AppDialog";
import MediaGrid, { type GridFilters } from "../media/MediaGrid";
import Uploader from "../media/Uploader";
import { useCompact } from "../../hooks/useCompact";

interface Props {
  open: boolean;
  onCancel: () => void;
  onPick: (asset: MediaAsset) => void;
  // Restrict the grid to a kind, e.g. "svg" for icon pickers.
  kind?: MediaQuery["kind"];
  // The kinds offered when `kind` is not set; images (raster, svg, gif)
  // unless the caller adds "video" (the media block and the media
  // section item only).
  kinds?: MediaKind[];
  title?: string;
  // Asset ids the library tab does not offer.
  excludeIds?: string[];
}

// A modal picker over the library grid, filtered to `state=ready` plus
// the caller's kind or kinds (images by default, so a video is offered
// only where the caller asks for it). The Upload tab runs the uploader
// inline and selects the asset when it becomes ready.
export default function MediaPicker({
  open,
  onCancel,
  onPick,
  kind,
  kinds = IMAGE_KINDS,
  title = "Choose media",
  excludeIds,
}: Props) {
  const compact = useCompact();
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [filters, setFilters] = useState<GridFilters>({});
  const [selected, setSelected] = useState<MediaAsset | null>(null);

  useEffect(() => {
    if (open) {
      setTab("library");
      setFilters({});
      setSelected(null);
    }
  }, [open]);

  const offered: MediaKind[] = kind ? [kind] : kinds;
  const allowVideo = offered.includes("video");

  const handleReady = (asset: MediaAsset) => {
    if (!offered.includes(asset.kind as MediaKind)) return;
    setSelected(asset);
    setTab("library");
    onPick(asset);
  };

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      fullScreen={compact}
    >
      <DialogTitle>{title}</DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, v: "library" | "upload") => setTab(v)}
        sx={{ px: 3 }}
      >
        <Tab label="Library" value="library" />
        <Tab label="Upload" value="upload" />
      </Tabs>
      <DialogContent dividers>
        {tab === "library" ? (
          <MediaGrid
            filters={filters}
            onFiltersChange={setFilters}
            onSelect={(a) => setSelected(a)}
            selectedId={selected?.id ?? null}
            fixedKind={kind}
            kinds={kind ? undefined : kinds}
            fixedState="ready"
            excludeIds={excludeIds}
          />
        ) : (
          <Uploader onReady={handleReady} allowVideo={allowVideo} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => (selected ? onPick(selected) : undefined)}
          disabled={!selected}
        >
          Choose
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
