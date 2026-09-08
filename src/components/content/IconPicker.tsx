import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { icons as iconsApi } from "../../api/resources/icons";
import { keys } from "../../queries/keys";
import type { Icon, IconInfo, MediaAsset } from "../../api/types";
import ErrorAlert from "../ErrorAlert";
import MediaGrid, { type GridFilters } from "../media/MediaGrid";
import Uploader from "../media/Uploader";

interface Props {
  open: boolean;
  onCancel: () => void;
  onPick: (icon: Icon) => void;
  title?: string;
}

// Curated library on tab 1; uploaded SVG assets on tab 2 (admin.md 6.14,
// 6.15). Uploading and picking the resulting asset is one flow.
export default function IconPicker({
  open,
  onCancel,
  onPick,
  title = "Choose icon",
}: Props) {
  const [tab, setTab] = useState<"library" | "svg" | "upload">("library");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Icon | null>(null);
  const [gridFilters, setGridFilters] = useState<GridFilters>({});

  useEffect(() => {
    if (open) {
      setTab("library");
      setSearch("");
      setSelected(null);
      setGridFilters({});
    }
  }, [open]);

  const iconsQ = useQuery({
    queryKey: keys.icons,
    queryFn: () => iconsApi.list(),
    enabled: open,
    staleTime: Infinity,
  });

  const filtered = useMemo(() => {
    const items = iconsQ.data?.items ?? [];
    if (!search.trim()) return items;
    const needle = search.trim().toLowerCase();
    return items.filter((i) => matchesIcon(i, needle));
  }, [iconsQ.data, search]);

  const handleUploaded = (asset: MediaAsset) => {
    if (typeof asset.id === "string") {
      const icon: Icon = { source: "media", id: asset.id };
      setSelected(icon);
      onPick(icon);
    }
  };

  const handleMediaSelect = (asset: MediaAsset) => {
    if (typeof asset.id === "string") {
      setSelected({ source: "media", id: asset.id });
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, v: "library" | "svg" | "upload") => setTab(v)}
        sx={{ px: 3 }}
      >
        <Tab label="Library" value="library" />
        <Tab label="SVG assets" value="svg" />
        <Tab label="Upload SVG" value="upload" />
      </Tabs>
      <DialogContent dividers>
        {tab === "library" ? (
          <Stack spacing={2}>
            <TextField
              label="Search icons"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
            />
            {iconsQ.error ? (
              <ErrorAlert error={iconsQ.error} />
            ) : iconsQ.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            ) : filtered.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No icons match “{search}”.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "repeat(4, 1fr)",
                    sm: "repeat(6, 1fr)",
                    md: "repeat(8, 1fr)",
                  },
                }}
                data-testid="icon-library-grid"
              >
                {filtered.map((icon) => (
                  <IconTile
                    key={String(icon.id)}
                    icon={icon}
                    selected={
                      selected?.source === "library" && selected.id === icon.id
                    }
                    onClick={() =>
                      setSelected({
                        source: "library",
                        id: String(icon.id),
                      })
                    }
                  />
                ))}
              </Box>
            )}
          </Stack>
        ) : tab === "svg" ? (
          <MediaGrid
            filters={gridFilters}
            onFiltersChange={setGridFilters}
            onSelect={handleMediaSelect}
            selectedId={
              selected?.source === "media" ? (selected.id as string) : null
            }
            fixedKind="svg"
            fixedState="ready"
            emptyText="No SVG assets"
          />
        ) : (
          <Uploader onReady={handleUploaded} />
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

function IconTile({
  icon,
  selected,
  onClick,
}: {
  icon: IconInfo;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        p: 1,
        border: 1,
        borderColor: selected ? "primary.main" : "divider",
        borderRadius: 1,
        cursor: "pointer",
        textAlign: "center",
        bgcolor: selected ? "action.selected" : "background.paper",
      }}
      data-testid={`icon-tile-${icon.id}`}
      aria-label={icon.name ?? String(icon.id)}
    >
      {icon.url ? (
        <Box
          component="img"
          src={icon.url}
          alt={icon.name ?? String(icon.id)}
          sx={{ width: 32, height: 32, display: "block", mx: "auto" }}
        />
      ) : (
        <Box sx={{ width: 32, height: 32, mx: "auto", bgcolor: "action.hover" }} />
      )}
      <Typography variant="caption" noWrap display="block">
        {icon.name ?? icon.id}
      </Typography>
    </Box>
  );
}

function matchesIcon(icon: IconInfo, needle: string): boolean {
  const parts: string[] = [];
  if (typeof icon.name === "string") parts.push(icon.name);
  if (typeof icon.id === "string") parts.push(icon.id);
  if (Array.isArray(icon.tags)) parts.push(...icon.tags.filter((t) => typeof t === "string"));
  const hay = parts.join(" ").toLowerCase();
  return hay.includes(needle);
}
