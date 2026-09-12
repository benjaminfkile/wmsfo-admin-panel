import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../api/errors";
import { events as eventsApi } from "../../api/resources/events";
import type { Event, MediaAsset } from "../../api/types";
import { keys } from "../../queries/keys";
import { useNotify } from "../../hooks/useNotify";
import ErrorAlert from "../../components/ErrorAlert";
import MediaPicker from "../../components/content/MediaPicker";

interface Props {
  event: Event;
}

// Route poster section on the event detail page (admin.md 6.3).
// Shows the current routeImage asset or "No poster"; opens
// MediaPicker (raster only). Sends PATCH { routeImageMediaId }
// (empty string to remove; null leaves it unchanged). On
// 409 media_not_ready reopens the picker on that asset.
export default function RoutePosterSection({ event }: Props) {
  const qc = useQueryClient();
  const notify = useNotify();
  const [pickerOpen, setPickerOpen] = useState(false);

  const patchMut = useMutation({
    mutationFn: (routeImageMediaId: string) =>
      eventsApi.patch(Number(event.id), { routeImageMediaId }),
    onSuccess: () => {
      notify("Route poster updated");
      void qc.invalidateQueries({ queryKey: keys.event(Number(event.id)) });
      void qc.invalidateQueries({ queryKey: keys.events });
      setPickerOpen(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "media_not_ready") {
        notify("Media not ready. Choose again.", "warning");
        setPickerOpen(true);
      } else {
        notify(
          e instanceof Error ? e.message : "Route poster update failed",
          "error"
        );
      }
    },
  });

  const routeImage = (event as Event & { routeImage?: MediaAsset | null })
    .routeImage;
  const posterId = event.routeImageMediaId ?? null;

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6">Route poster</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setPickerOpen(true)}
              data-testid="route-poster-choose"
            >
              Choose poster
            </Button>
            {posterId ? (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => patchMut.mutate("")}
                data-testid="route-poster-remove"
              >
                Remove poster
              </Button>
            ) : null}
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Shown on the route page and as the route preview. Use the highest
          resolution you have; the site serves smaller copies where it can.
        </Typography>
        {patchMut.error ? (
          <Box sx={{ my: 2 }}>
            <ErrorAlert error={patchMut.error} />
          </Box>
        ) : null}
        <Box sx={{ mt: 2 }}>
          {routeImage ? (
            <PosterPreview asset={routeImage} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No poster.
            </Typography>
          )}
        </Box>
      </CardContent>
      <MediaPicker
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onPick={(asset) => {
          if (typeof asset.id === "string") {
            patchMut.mutate(asset.id);
          }
        }}
        kind="raster"
        title="Choose route poster"
      />
    </Card>
  );
}

function PosterPreview({ asset }: { asset: MediaAsset }) {
  const v480 =
    asset.variants && typeof asset.variants === "object"
      ? (asset.variants as Record<string, string>)["480"]
      : undefined;
  const url = v480 ?? asset.url ?? "";
  const dims =
    asset.width && asset.height
      ? `${asset.width} × ${asset.height}`
      : "unknown size";
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      {url ? (
        <Box
          component="img"
          src={url}
          alt={asset.alt ?? ""}
          sx={{ maxWidth: 240, maxHeight: 160, objectFit: "contain" }}
        />
      ) : null}
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{asset.filename}</Typography>
        <Typography variant="body2" color="text.secondary">
          {dims}
        </Typography>
      </Stack>
    </Stack>
  );
}
