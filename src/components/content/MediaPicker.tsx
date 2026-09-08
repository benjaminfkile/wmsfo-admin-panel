import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import type { MediaAsset } from "../../api/types";
import type { MediaQuery } from "../../api/resources/media";
import MediaGrid, { type GridFilters } from "../media/MediaGrid";
import Uploader from "../media/Uploader";

interface Props {
  open: boolean;
  onCancel: () => void;
  onPick: (asset: MediaAsset) => void;
  // Restrict the grid to a kind, e.g. "svg" for icon pickers.
  kind?: MediaQuery["kind"];
  title?: string;
}

// A modal picker over the library grid, filtered to `state=ready` plus
// the caller's kind. The Upload tab runs the uploader inline and
// selects the asset when it becomes ready.
export default function MediaPicker({
  open,
  onCancel,
  onPick,
  kind,
  title = "Choose media",
}: Props) {
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

  const handleReady = (asset: MediaAsset) => {
    setSelected(asset);
    setTab("library");
    onPick(asset);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
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
            fixedState="ready"
          />
        ) : (
          <Uploader onReady={handleReady} />
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
    </Dialog>
  );
}
