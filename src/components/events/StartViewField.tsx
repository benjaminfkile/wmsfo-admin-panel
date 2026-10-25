import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, FormHelperText, Stack, Typography } from "@mui/material";
import { useConfig } from "../../ConfigContext";
import { loadMaps } from "../../pages/places/googleMaps";
import HelpButton from "../../help/HelpButton";
import type { Bbox } from "../bbox/bbox";
import {
  clampStartView,
  clampStartZoom,
  round5,
  sameStartView,
  startMinZoom,
  startViewCaption,
  startViewInside,
  type StartView,
} from "./startView";

interface Props {
  value: StartView | null;
  onChange: (next: StartView | null) => void;
  // The event's box: the map is restricted to it and the centre stays
  // inside it.
  bbox: Bbox;
  // A server error at `trackerStartView`, shown under the field.
  error?: string | null;
}

const MAP_HEIGHT = 300;
const NO_KEY_NOTE = "Set VITE_GOOGLE_MAPS_KEY to set the start view on a map.";
const MOVED_NOTE = "Start view moved inside the new area";

function boundsOf(b: Bbox): google.maps.LatLngBoundsLiteral {
  return { north: b.north, south: b.south, east: b.east, west: b.west };
}

// The event's tracker start view (admin.md 6.3, 6.29), under the area
// field in the create dialog, the Tracker map card, and the clone dialog.
// A Google map 300 px tall, restricted to the box (`strictBounds`, the
// minimum zoom the box's fit), shows the start view, or the whole box
// while there is none; panning or zooming it writes the centre (five
// decimals) and the integer zoom on idle. The caption reads the centre and
// zoom, and "Use whole area" clears the value so the tracker fits the box.
// When the box changes and leaves the centre outside, the centre moves to
// the nearest point inside and one line says so. Without the Maps key, or
// when the map fails to load, a note replaces the map.
export default function StartViewField({ value, onChange, bbox, error }: Props) {
  const config = useConfig();
  const key = config.googleMapsKey;
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const valueRef = useRef(value);
  const bboxRef = useRef(bbox);
  const onChangeRef = useRef(onChange);
  // Set by the admin's gestures on the map; only an idle after one writes
  // the value, so the map's own fitting never does.
  const userMoveRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // The view the field moved inside the new box; the line shows while the
  // value is still that view.
  const [movedTo, setMovedTo] = useState<StartView | null>(null);

  valueRef.current = value;
  bboxRef.current = bbox;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const div = mapDiv.current;
    if (!div) return;
    const markUser = () => {
      userMoveRef.current = true;
    };
    const gestures = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    for (const name of gestures) div.addEventListener(name, markUser, { capture: true });
    const listeners: google.maps.MapsEventListener[] = [];
    (async () => {
      try {
        const maps = await loadMaps(key);
        if (cancelled) return;
        const map = new maps.Map(div, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        listeners.push(map.addListener("dragstart", markUser));
        listeners.push(
          map.addListener("idle", () => {
            if (!userMoveRef.current) return;
            userMoveRef.current = false;
            const c = map.getCenter();
            const z = map.getZoom();
            if (!c || typeof z !== "number") return;
            const next: StartView = {
              center: { lat: round5(c.lat()), lng: round5(c.lng()) },
              zoom: clampStartZoom(z),
            };
            if (sameStartView(valueRef.current, next)) return;
            onChangeRef.current(next);
          }),
        );
        setReady(true);
      } catch (e) {
        if (!cancelled) setMapError(e instanceof Error ? e.message : "Map failed to load");
      }
    })();
    return () => {
      cancelled = true;
      for (const name of gestures) div.removeEventListener(name, markUser, { capture: true });
      for (const l of listeners) l.remove();
      mapRef.current = null;
    };
  }, [key]);

  // A box change that leaves the centre outside moves it to the nearest
  // point inside.
  const boxKey = JSON.stringify(bbox);
  const prevBoxKey = useRef(boxKey);
  useEffect(() => {
    if (prevBoxKey.current === boxKey) return;
    prevBoxKey.current = boxKey;
    const v = valueRef.current;
    if (v === null || startViewInside(v, bboxRef.current)) return;
    const moved = clampStartView(v, bboxRef.current);
    setMovedTo(moved);
    onChangeRef.current(moved);
  }, [boxKey]);

  // The map is restricted to the box, no further out than its fit.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const b = JSON.parse(boxKey) as Bbox;
    const width = mapDiv.current?.clientWidth || MAP_HEIGHT;
    userMoveRef.current = false;
    map.setOptions({
      restriction: { latLngBounds: boundsOf(b), strictBounds: true },
      minZoom: startMinZoom(b, width, MAP_HEIGHT),
    });
    if (valueRef.current === null) map.fitBounds(boundsOf(b), 0);
  }, [boxKey, ready]);

  // The map follows a value it did not write: the start view, or the
  // whole box without one.
  const lat = value?.center.lat;
  const lng = value?.center.lng;
  const zoom = value?.zoom;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (lat === undefined || lng === undefined || zoom === undefined) {
      userMoveRef.current = false;
      map.fitBounds(boundsOf(bboxRef.current), 0);
      return;
    }
    const c = map.getCenter();
    const z = map.getZoom();
    if (!c || round5(c.lat()) !== lat || round5(c.lng()) !== lng) {
      userMoveRef.current = false;
      map.setCenter({ lat, lng });
    }
    if (typeof z !== "number" || Math.round(z) !== zoom) {
      userMoveRef.current = false;
      map.setZoom(zoom);
    }
  }, [lat, lng, zoom, ready]);

  const showMoved = movedTo !== null && sameStartView(value, movedTo);

  return (
    <Box data-testid="start-view-field">
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="subtitle1">Start view</Typography>
        <HelpButton topic="events.detail.tracker-map.start-view" />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Where the tracker opens: move the map to the view you want.
      </Typography>
      {!key || mapError ? (
        <Alert
          severity={mapError ? "warning" : "info"}
          variant="outlined"
          data-testid="start-view-note"
          sx={{ my: 1 }}
        >
          {mapError ?? NO_KEY_NOTE}
        </Alert>
      ) : (
        <Box
          ref={mapDiv}
          data-testid="start-view-map"
          sx={{ width: "100%", height: MAP_HEIGHT, borderRadius: 1, overflow: "hidden", my: 1 }}
        />
      )}
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Typography variant="body2" data-testid="start-view-caption" sx={{ flexGrow: 1 }}>
          {startViewCaption(value)}
        </Typography>
        <Button
          size="small"
          disabled={value === null}
          onClick={() => {
            setMovedTo(null);
            onChange(null);
          }}
        >
          Use whole area
        </Button>
      </Stack>
      {showMoved ? (
        <FormHelperText data-testid="start-view-moved">{MOVED_NOTE}</FormHelperText>
      ) : null}
      {error ? (
        <FormHelperText error data-testid="start-view-error">
          {error}
        </FormHelperText>
      ) : null}
    </Box>
  );
}
