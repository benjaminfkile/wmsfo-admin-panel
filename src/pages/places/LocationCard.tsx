import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Place } from "../../api/types";
import { loadMaps, loadMarkers, loadPlaces } from "./googleMaps";

// admin.md 6.24 place detail: the pin on a Google map (draggable when
// set), "Use my location" (Geolocation API; accuracy shown; refused
// fixes worse than 500 m), a Places Autocomplete search box, "Use the
// parent's pin" (deletes the own location). Every pin write carries a
// `source`.

interface Props {
  place: Place;
  apiKey: string;
  onPin: (v: {
    lat: number;
    lng: number;
    accuracyM: number | null;
    source: "phone" | "search" | "drag";
  }) => void;
  onClearOwnPin: () => void;
  saving?: boolean;
}

const DEFAULT_ZOOM = 16;
const FALLBACK_CENTER = { lat: 46.916, lng: -114.039 };
// admin.md 6.24 refusal threshold for the Geolocation fix.
export const GEO_MAX_ACCURACY_M = 500;

export default function LocationCard({
  place,
  apiKey,
  onPin,
  onClearOwnPin,
  saving = false,
}: Props) {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneStatus, setPhoneStatus] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const hasOwnPin = !!place.location;
  const initialCenter = place.pin
    ? { lat: place.pin.lat, lng: place.pin.lng }
    : FALLBACK_CENTER;

  useEffect(() => {
    let cancelled = false;
    const div = mapDiv.current;
    if (!div) return;

    (async () => {
      try {
        const maps = await loadMaps(apiKey);
        if (cancelled) return;
        const map = new maps.Map(div, {
          center: initialCenter,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        const markerLib = await loadMarkers(apiKey);
        if (cancelled) return;
        const marker = new markerLib.Marker({
          position: initialCenter,
          map,
          draggable: hasOwnPin,
        });
        markerRef.current = marker;

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          onPin({
            lat: pos.lat(),
            lng: pos.lng(),
            accuracyM: null,
            source: "drag",
          });
        });

        // Places Autocomplete on the search input.
        const placesLib = await loadPlaces(apiKey);
        if (cancelled) return;
        if (inputRef.current) {
          const ac = new placesLib.Autocomplete(inputRef.current, {
            fields: ["geometry"],
          });
          ac.bindTo("bounds", map);
          ac.addListener("place_changed", () => {
            const p = ac.getPlace();
            const geo = p.geometry?.location;
            if (!geo) return;
            const lat = geo.lat();
            const lng = geo.lng();
            marker.setPosition({ lat, lng });
            map.panTo({ lat, lng });
            onPin({ lat, lng, accuracyM: null, source: "search" });
          });
        }

        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Map failed to load");
      }
    })();

    return () => {
      cancelled = true;
    };
    // The loader is scoped to the api key; ignore the other deps to
    // avoid re-initialising the map on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Keep the marker's position and draggability in sync when the place
  // updates (a pin write returns a fresh Place; the parent passes it
  // back down).
  useEffect(() => {
    const m = markerRef.current;
    if (!m || !ready) return;
    if (place.pin) {
      m.setPosition({ lat: place.pin.lat, lng: place.pin.lng });
      mapRef.current?.panTo({ lat: place.pin.lat, lng: place.pin.lng });
    }
    m.setDraggable(hasOwnPin);
  }, [place.pin, hasOwnPin, ready]);

  const useMyLocation = () => {
    setError(null);
    setPhoneStatus("Locating…");
    if (!("geolocation" in navigator)) {
      setPhoneStatus(null);
      setError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        if (acc == null || acc > GEO_MAX_ACCURACY_M) {
          setPhoneStatus(null);
          setError(
            `Accuracy is ${Math.round(acc ?? 0)} m, worse than 500 m. Search or drag the pin instead.`,
          );
          return;
        }
        setPhoneStatus(`Fix accepted (accuracy ${Math.round(acc)} m).`);
        onPin({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: acc,
          source: "phone",
        });
      },
      (err) => {
        setPhoneStatus(null);
        setError(`Location failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const parentHasPin = !!place.pin && place.pin.fromPlaceId !== place.id;
  const canUseParent = hasOwnPin && place.parentId != null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Location
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          {hasOwnPin ? (
            <Chip label="Own pin" color="success" size="small" />
          ) : parentHasPin ? (
            <Chip
              label="Uses the parent's pin"
              variant="outlined"
              size="small"
            />
          ) : (
            <Chip label="No pin" size="small" />
          )}
          {place.location ? (
            <Typography variant="caption" color="text.secondary">
              {place.location.source} · pinned by {stripPersonPrefix(place.location.pinnedBy)}
            </Typography>
          ) : null}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 1 }} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            onClick={useMyLocation}
            disabled={saving}
          >
            Use my location
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={onClearOwnPin}
            disabled={!canUseParent || saving}
          >
            Use the parent's pin
          </Button>
        </Stack>

        {phoneStatus ? (
          <Typography variant="caption" color="text.secondary">
            {phoneStatus}
          </Typography>
        ) : null}
        {error ? (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {error}
          </Alert>
        ) : null}

        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder="Search for a place (Google Places)"
          sx={{ mt: 1, mb: 1 }}
          inputProps={{ "aria-label": "Places search" }}
        />

        <Box
          ref={mapDiv}
          data-testid="places-map-container"
          sx={{
            width: "100%",
            height: 320,
            borderRadius: 1,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        />
      </CardContent>
    </Card>
  );
}

function stripPersonPrefix(s: string): string {
  return s.startsWith("person:") ? s.slice("person:".length) : s;
}
