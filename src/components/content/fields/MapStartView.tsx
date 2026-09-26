import { useEffect, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import { useConfig } from "../../../ConfigContext";
import { loadMaps } from "../../../pages/places/googleMaps";

export interface MapStart {
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
}

interface Props {
  value: MapStart;
  onChange: (next: MapStart) => void;
  disabled?: boolean;
}

const NO_KEY_NOTE =
  "Set VITE_GOOGLE_MAPS_KEY to preview the starting view on a map.";

function round5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

function nearlyEqual(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) < eps;
}

// admin.md 6.14: sets the map section's starting view. A Google map
// 300 px tall shows the current centre and zoom; panning or zooming
// writes `defaultCenter` (rounded to five decimals) and `defaultZoom`
// (integer) on idle. The three number fields under the map still take
// exact entries and move the map when edited. When the Maps key is
// absent or the loader fails the map is replaced by a one-line note
// so the number fields remain the only editor.
export default function MapStartView({ value, onChange, disabled }: Props) {
  const config = useConfig();
  const key = config.googleMapsKey;
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const div = mapDiv.current;
    if (!div) return;
    (async () => {
      try {
        const maps = await loadMaps(key);
        if (cancelled) return;
        const map = new maps.Map(div, {
          center: valueRef.current.defaultCenter,
          zoom: valueRef.current.defaultZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        listenerRef.current = map.addListener("idle", () => {
          const c = map.getCenter();
          const z = map.getZoom();
          if (!c || typeof z !== "number") return;
          const nextCenter = { lat: round5(c.lat()), lng: round5(c.lng()) };
          const nextZoom = Math.round(z);
          const cur = valueRef.current;
          if (
            cur.defaultCenter.lat === nextCenter.lat &&
            cur.defaultCenter.lng === nextCenter.lng &&
            cur.defaultZoom === nextZoom
          ) {
            return;
          }
          onChangeRef.current({
            defaultCenter: nextCenter,
            defaultZoom: nextZoom,
          });
        });
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Map failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
      listenerRef.current?.remove();
      listenerRef.current = null;
      mapRef.current = null;
    };
  }, [key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const c = map.getCenter();
    const z = map.getZoom();
    if (
      !c ||
      typeof z !== "number" ||
      !nearlyEqual(c.lat(), value.defaultCenter.lat, 1e-5) ||
      !nearlyEqual(c.lng(), value.defaultCenter.lng, 1e-5)
    ) {
      map.setCenter(value.defaultCenter);
    }
    if (typeof z !== "number" || z !== value.defaultZoom) {
      map.setZoom(value.defaultZoom);
    }
  }, [value.defaultCenter, value.defaultZoom, ready]);

  if (!key) {
    return (
      <Alert
        severity="info"
        variant="outlined"
        data-testid="map-start-view-note"
        sx={{ my: 1 }}
      >
        {NO_KEY_NOTE}
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        variant="outlined"
        data-testid="map-start-view-note"
        sx={{ my: 1 }}
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ my: 1 }} data-testid="map-start-view">
      <Box
        ref={mapDiv}
        data-testid="map-start-view-canvas"
        aria-disabled={disabled ? true : undefined}
        sx={{ width: "100%", height: 300, borderRadius: 1, overflow: "hidden" }}
      />
    </Box>
  );
}
