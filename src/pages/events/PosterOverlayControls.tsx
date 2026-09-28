import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { qr as qrApi } from "../../api/resources/qr";
import type { MediaAsset, QrCode } from "../../api/types";
import AppDialog from "../../components/AppDialog";
import MediaPicker from "../../components/content/MediaPicker";
import { useCompact } from "../../hooks/useCompact";
import { keys } from "../../queries/keys";

interface Props {
  disabled: boolean;
  // The site logo's media id from site settings, or null when none is set.
  logoMediaId: string | null;
  selected: boolean;
  canForward: boolean;
  canBack: boolean;
  hasElements: boolean;
  saving: boolean;
  onAddImage: (asset: MediaAsset) => void;
  onAddLogo: (mediaId: string) => void;
  onAddQr: (code: QrCode) => void;
  onForward: () => void;
  onBack: () => void;
  onDelete: () => void;
  onClear: () => void;
  onSave: () => void;
}

export const GIF_REFUSED = "Animated GIFs cannot be placed on a poster. Choose a raster image or an SVG.";

// The overlay toolbar of the poster generator: add an image from the media
// library (raster or svg), the site logo (shown only when site settings
// have one), or a QR code; move the selected element forward or back;
// delete it; clear the layout; and save it on the event.
export default function PosterOverlayControls(props: Props) {
  const { disabled, logoMediaId, selected } = props;
  const [mediaOpen, setMediaOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  return (
    <Stack spacing={1} data-testid="poster-overlay-controls">
      <Typography variant="subtitle2" component="h3">
        Overlays
      </Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button size="small" variant="outlined" disabled={disabled} onClick={() => setMediaOpen(true)} data-testid="poster-overlay-add-image">
          Add image
        </Button>
        {logoMediaId ? (
          <Button
            size="small"
            variant="outlined"
            disabled={disabled}
            onClick={() => props.onAddLogo(logoMediaId)}
            data-testid="poster-overlay-add-logo"
          >
            Add logo
          </Button>
        ) : null}
        <Button size="small" variant="outlined" disabled={disabled} onClick={() => setQrOpen(true)} data-testid="poster-overlay-add-qr">
          Add QR code
        </Button>
      </Stack>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button size="small" disabled={disabled || !selected || !props.canForward} onClick={props.onForward} data-testid="poster-overlay-forward">
          Forward
        </Button>
        <Button size="small" disabled={disabled || !selected || !props.canBack} onClick={props.onBack} data-testid="poster-overlay-back">
          Back
        </Button>
        <Button size="small" color="error" disabled={disabled || !selected} onClick={props.onDelete} data-testid="poster-overlay-delete">
          Delete
        </Button>
        <Button size="small" disabled={disabled || !props.hasElements} onClick={props.onClear} data-testid="poster-overlay-clear">
          Clear layout
        </Button>
        <Button size="small" variant="outlined" disabled={disabled || props.saving} onClick={props.onSave} data-testid="poster-overlay-save">
          Save layout
        </Button>
      </Stack>
      {refused ? (
        <Alert severity="warning" onClose={() => setRefused(null)}>
          {refused}
        </Alert>
      ) : null}
      <MediaPicker
        open={mediaOpen}
        title="Choose an overlay image"
        onCancel={() => setMediaOpen(false)}
        onPick={(asset) => {
          setMediaOpen(false);
          if (asset.kind === "gif") {
            setRefused(GIF_REFUSED);
            return;
          }
          setRefused(null);
          props.onAddImage(asset);
        }}
      />
      <QrCodePicker
        open={qrOpen}
        onCancel={() => setQrOpen(false)}
        onPick={(code) => {
          setQrOpen(false);
          props.onAddQr(code);
        }}
      />
    </Stack>
  );
}

function placeOf(code: QrCode): string {
  return code.attachment ? code.attachment.placePath.join(" / ") : "Not attached";
}

// A dialog over the QR codes list, searched by tag and place.
function QrCodePicker({
  open,
  onCancel,
  onPick,
}: {
  open: boolean;
  onCancel: () => void;
  onPick: (code: QrCode) => void;
}) {
  const compact = useCompact();
  const [search, setSearch] = useState("");
  const listQ = useQuery({
    queryKey: keys.qrCodes,
    queryFn: () => qrApi.list(),
    enabled: open,
  });
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = [...(listQ.data?.items ?? [])].sort((a, b) => a.tag.localeCompare(b.tag));
    return q
      ? items.filter((c) => c.tag.toLowerCase().includes(q) || placeOf(c).toLowerCase().includes(q))
      : items;
  }, [listQ.data, search]);

  return (
    <AppDialog open={open} onClose={onCancel} fullWidth maxWidth="xs" fullScreen={compact}>
      <DialogTitle>Choose a QR code</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Search by tag or place"
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ htmlInput: { "data-testid": "poster-qr-search" } }}
        />
        {listQ.isError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            The QR codes could not load.
          </Alert>
        ) : listQ.isSuccess && matches.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No QR codes match.
          </Typography>
        ) : (
          <List dense data-testid="poster-qr-list">
            {matches.map((code) => (
              <ListItemButton key={code.id} onClick={() => onPick(code)}>
                <ListItemText primary={code.tag} secondary={placeOf(code)} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
      </DialogActions>
    </AppDialog>
  );
}
