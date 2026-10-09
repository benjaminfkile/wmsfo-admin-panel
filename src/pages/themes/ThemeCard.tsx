import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery } from "@tanstack/react-query";
import { media as mediaApi } from "../../api/resources/media";
import { keys } from "../../queries/keys";
import AuditCell from "../../components/audit/AuditCell";
import { useCompact } from "../../hooks/useCompact";
import type { TrackerTheme } from "../../api/types";

// The seven chrome colours in the order the card shows them.
const CHROME_KEYS = [
  "bg",
  "fg",
  "text",
  "tile",
  "tileFg",
  "panel",
  "accent",
] as const;

interface Props {
  theme: TrackerTheme;
  eventCount: number;
  disabled: boolean;
  onEdit: () => void;
  onMenu: (el: HTMLElement) => void;
}

// One theme in its renderer's sortable list (admin.md 6.28): the drag
// handle, the thumbnail or chrome swatch, the name, the key, the seven
// chrome swatches, the default badges, the events count, the pencil,
// the row menu, and the audit button.
export default function ThemeCard({
  theme,
  eventCount,
  disabled,
  onEdit,
  onMenu,
}: Props) {
  const compact = useCompact();
  const id = Number(theme.id);
  const sortable = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
  };
  const name = theme.name ?? `#${String(theme.id)}`;
  const handle = compact ? 44 : 32;

  return (
    <Paper
      ref={sortable.setNodeRef}
      style={style}
      variant="outlined"
      data-testid={`theme-card-${String(theme.id)}`}
      sx={{ p: 1 }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton
          disabled={disabled}
          aria-label={`Drag ${name}`}
          data-testid={`theme-drag-${String(theme.id)}`}
          {...sortable.attributes}
          {...sortable.listeners}
          sx={{ width: handle, height: handle, cursor: "grab", flexShrink: 0 }}
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        <ThemeThumb theme={theme} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body1" sx={{ wordBreak: "break-word" }}>
            {name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: "monospace" }}
          >
            {theme.key}
          </Typography>
        </Box>
        <IconButton size="small" aria-label={`Edit ${name}`} onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label={`Actions for ${name}`}
          onClick={(ev) => onMenu(ev.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ mt: 1 }}
        data-testid={`theme-chrome-${String(theme.id)}`}
      >
        {CHROME_KEYS.map((k) => {
          const colour = theme.chrome?.[k] ?? "transparent";
          return (
            <Tooltip key={k} title={`${k} ${colour}`}>
              <Box
                data-testid={`theme-chrome-${String(theme.id)}-${k}`}
                data-colour={colour}
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: 0.5,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: colour,
                }}
              />
            </Tooltip>
          );
        })}
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ mt: 1 }}
      >
        {theme.defaultLightMode ? (
          <Chip size="small" color="primary" label="Light default" />
        ) : null}
        {theme.defaultDarkMode ? (
          <Chip size="small" color="primary" label="Dark default" />
        ) : null}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexGrow: 1 }}
          data-testid={`theme-events-${String(theme.id)}`}
        >
          Used by {eventCount} {eventCount === 1 ? "event" : "events"}
        </Typography>
        <AuditCell
          entity="tracker_theme"
          entityId={theme.id ?? ""}
          name={name}
          audit={theme.audit}
          asCell={false}
        />
      </Stack>
    </Paper>
  );
}

// The `480` variant of the thumbnail's media asset, or a swatch of the
// chrome `bg` and `accent` when the theme has none.
function ThemeThumb({ theme }: { theme: TrackerTheme }) {
  const mediaId = theme.thumbnailMediaId ?? "";
  const q = useQuery({
    queryKey: keys.mediaAsset(mediaId),
    queryFn: () => mediaApi.get(mediaId),
    enabled: mediaId !== "",
    staleTime: Infinity,
    retry: false,
  });
  const v480 = q.data?.variants?.["480"];
  const src = typeof v480 === "string" && v480 !== "" ? v480 : q.data?.url;
  const size = { width: 96, height: 64, borderRadius: 0.5, flexShrink: 0 };
  if (mediaId !== "" && src) {
    return (
      <Box
        component="img"
        src={src}
        alt=""
        data-testid={`theme-thumb-${String(theme.id)}`}
        sx={{ ...size, objectFit: "cover" }}
      />
    );
  }
  return (
    <Box
      data-testid={`theme-swatch-${String(theme.id)}`}
      sx={{
        ...size,
        border: 1,
        borderColor: "divider",
        background: `linear-gradient(135deg, ${theme.chrome?.bg ?? "#ffffff"} 50%, ${
          theme.chrome?.accent ?? "#000000"
        } 50%)`,
      }}
    />
  );
}
