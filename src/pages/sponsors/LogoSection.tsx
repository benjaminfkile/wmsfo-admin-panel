import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import MediaPicker from "../../components/content/MediaPicker";
import type { MediaAsset, Sponsor } from "../../api/types";

interface Props {
  sponsor: Sponsor;
  disabled?: boolean;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onPick: (asset: MediaAsset) => void;
  onRemove: () => void;
}

// 6.6: the sponsor logo section. The picker is a controlled dialog so
// the parent can reopen it after a 409 media_not_ready.
export default function LogoSection({
  sponsor,
  disabled = false,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onPick,
  onRemove,
}: Props) {
  const logo = sponsor.logo;
  const preview =
    logo && typeof logo.variants?.["480"] === "string"
      ? logo.variants["480"]
      : logo?.url ?? null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Logo
        </Typography>
        <Stack direction="row" spacing={3} alignItems="flex-start">
          <Box
            sx={{
              width: 120,
              height: 120,
              bgcolor: "action.hover",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderRadius: 1,
            }}
          >
            {preview ? (
              <Box
                component="img"
                src={preview}
                alt={logo?.alt ?? sponsor.name ?? ""}
                sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                data-testid="sponsor-logo-preview"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No logo
              </Typography>
            )}
          </Box>
          <Stack spacing={1}>
            {logo ? (
              <>
                <Typography variant="body2">
                  {logo.filename ?? "asset"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {typeof logo.width === "number" && typeof logo.height === "number"
                    ? `${logo.width} × ${logo.height}`
                    : ""}
                </Typography>
              </>
            ) : null}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={onOpenPicker}
                disabled={disabled}
              >
                Choose logo
              </Button>
              {logo ? (
                <Button
                  color="error"
                  onClick={onRemove}
                  disabled={disabled}
                >
                  Remove
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
      <MediaPicker
        open={pickerOpen}
        onCancel={onClosePicker}
        onPick={onPick}
        title="Choose sponsor logo"
      />
    </Card>
  );
}
