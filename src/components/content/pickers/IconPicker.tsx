import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
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
import { icons as iconsApi } from "../../../api/resources/icons";
import { keys } from "../../../queries/keys";
import type { Icon, IconInfo, MediaAsset } from "../../../api/types";
import AppDialog from "../../AppDialog";
import ErrorAlert from "../../ErrorAlert";
import MediaGrid, { type GridFilters } from "../../media/MediaGrid";
import Uploader from "../../media/Uploader";
import { useCompact } from "../../../hooks/useCompact";

interface Props {
  open: boolean;
  onCancel: () => void;
  onPick: (icon: Icon) => void;
  title?: string;
}

// The icon picker for every icon field in the panel (admin.md 6.7,
// 6.14). Library icons on the first tab, any ready image from the media
// library on the second, and Upload on the third; Choose confirms.
export default function IconPicker({
  open,
  onCancel,
  onPick,
  title = "Choose icon",
}: Props) {
  const compact = useCompact();
  const [tab, setTab] = useState<"library" | "media" | "upload">("library");
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

  const commit = () => {
    if (selected) onPick(selected);
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
        onChange={(_, v: "library" | "media" | "upload") => setTab(v)}
        sx={{ px: 3 }}
      >
        <Tab label="Library" value="library" />
        <Tab label="Media library" value="media" />
        <Tab label="Upload" value="upload" />
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
                {`No icons match "${search}".`}
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "repeat(2, 1fr)",
                    sm: "repeat(2, 1fr)",
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
                    onSelect={() =>
                      setSelected({
                        source: "library",
                        id: String(icon.id),
                      })
                    }
                    onPick={() =>
                      onPick({ source: "library", id: String(icon.id) })
                    }
                  />
                ))}
              </Box>
            )}
          </Stack>
        ) : tab === "media" ? (
          <MediaGrid
            filters={gridFilters}
            onFiltersChange={setGridFilters}
            onSelect={handleMediaSelect}
            selectedId={
              selected?.source === "media" ? (selected.id as string) : null
            }
            fixedState="ready"
            emptyText="No media"
          />
        ) : (
          <Uploader onReady={handleUploaded} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={commit}
          disabled={!selected}
        >
          Choose
        </Button>
      </DialogActions>
    </AppDialog>
  );
}

function IconTile({
  icon,
  selected,
  onSelect,
  onPick,
}: {
  icon: IconInfo;
  selected: boolean;
  onSelect: () => void;
  onPick: () => void;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onPick();
        } else if (e.key === " ") {
          e.preventDefault();
          onSelect();
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
  if (Array.isArray(icon.tags))
    parts.push(...icon.tags.filter((t) => typeof t === "string"));
  const hay = parts.join(" ").toLowerCase();
  return hay.includes(needle);
}
