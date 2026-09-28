import { useEffect, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import { useConfig } from "../../../ConfigContext";
import { loadMaps, loadMarkers } from "../../../pages/places/googleMaps";
import { roundCoord } from "../landmarks";

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  // The pin, or null before one is placed.
  value: LatLng | null;
  // Where the map opens when there is no pin.
  center: LatLng;
  onPick: (next: LatLng) => void;
}

const ZOOM = 13;

const NO_KEY_NOTE =
  "Set VITE_GOOGLE_MAPS_KEY to place the pin on a map; the latitude and longitude fields still work.";

// A Google map 300 px tall on the site's key (the places pages' loader).
// A click moves the pin there and reports the point rounded to five
// decimals; dragging the pin does the same. A change to `value` from
// outside (the number fields) moves the pin. With the key absent or the
// loader failing the map is replaced by a one-line note.
export default function LandmarkPicker({ value, center, onPick }: Props) {
  const config = useConfig();
  const key = config.googleMapsKey;
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const startRef = useRef(value ?? center);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!key) return;
    const div = mapDiv.current;
    if (!div) return;
    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];
    (async () => {
      try {
        const maps = await loadMaps(key);
        if (cancelled) return;
        const map = new maps.Map(div, {
          center: startRef.current,
          zoom: ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          draggableCursor: "crosshair",
        });
        mapRef.current = map;
        const markerLib = await loadMarkers(key);
        if (cancelled) return;
        const marker = new markerLib.Marker({ draggable: true });
        markerRef.current = marker;
        const report = (p: google.maps.LatLng | null | undefined) => {
          if (!p) return;
          const next = { lat: roundCoord(p.lat()), lng: roundCoord(p.lng()) };
          marker.setPosition(next);
          marker.setMap(map);
          onPickRef.current(next);
        };
        listeners.push(
          map.addListener("click", (e: google.maps.MapMouseEvent) => report(e.latLng))
        );
        listeners.push(marker.addListener("dragend", () => report(marker.getPosition())));
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Map failed to load");
      }
    })();
    return () => {
      cancelled = true;
      for (const l of listeners) l.remove();
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [key]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!ready || !marker) return;
    if (value) {
      marker.setPosition(value);
      marker.setMap(mapRef.current);
    } else {
      marker.setMap(null);
    }
  }, [value, ready]);

  if (!key || error) {
    return (
      <Alert
        severity={error ? "warning" : "info"}
        variant="outlined"
        data-testid="landmark-picker-note"
      >
        {error ?? NO_KEY_NOTE}
      </Alert>
    );
  }

  return (
    <Box
      ref={mapDiv}
      data-testid="landmark-picker-map"
      sx={{ width: "100%", height: 300, borderRadius: 1, overflow: "hidden" }}
    />
  );
}
