import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormHelperText,
  Stack,
  TextField,
  ToggleButton,
  Typography,
} from "@mui/material";
import CropFreeIcon from "@mui/icons-material/CropFree";
import { useConfig } from "../../ConfigContext";
import { useCompact } from "../../hooks/useCompact";
import { useNotify } from "../../hooks/useNotify";
import { downloadText } from "../../lib/download";
import HelpButton from "../../help/HelpButton";
import type { HelpKey } from "../../help/helpKeys";
import { loadMaps, loadMarkers } from "../../pages/places/googleMaps";
import {
  BBOX_SIDES,
  EXPORT_MAX_ZOOM,
  EXPORT_TERRAIN_MAX_ZOOM,
  MAX_ZOOM_RANGE,
  TERRAIN_MAX_ZOOM_RANGE,
  clampZoom,
  exportDocument,
  exportFileName,
  minZoomCaption,
  roundBbox,
  validateBbox,
  type Bbox,
  type BboxSide,
} from "./bbox";

interface Props {
  value: Bbox;
  onChange: (next: Bbox) => void;
  // The export's `name` and file name.
  exportName: string;
  help?: HelpKey;
  // The title shown beside the Draw area toggle.
  label?: string;
  // A server error at the box, shown under the fields.
  error?: string | null;
}

const FIELD_LABELS: Record<BboxSide, string> = {
  west: "West",
  south: "South",
  east: "East",
  north: "North",
};

const FIT_PADDING = 24;
const BOX_COLOR = "#1a56c4";

type Corner = "nw" | "ne" | "sw" | "se";
const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

type Point = { lat: number; lng: number };

type MapState = "unset" | "loading" | "ready" | "failed";

// A 16 px white dot with a 3 px border, centred on the corner: a circle
// of radius 6.5 px whose stroke reaches 8 px.
const HANDLE_ICON: google.maps.Symbol = {
  path: "M -6.5 0 A 6.5 6.5 0 1 0 6.5 0 A 6.5 6.5 0 1 0 -6.5 0 Z",
  fillColor: "#ffffff",
  fillOpacity: 1,
  strokeColor: BOX_COLOR,
  strokeOpacity: 1,
  strokeWeight: 3,
  scale: 1,
};

function cornerPoint(b: Bbox, c: Corner): Point {
  return {
    lat: c === "nw" || c === "ne" ? b.north : b.south,
    lng: c === "nw" || c === "sw" ? b.west : b.east,
  };
}

function withCorner(b: Bbox, c: Corner, p: Point): Bbox {
  const next = { ...b };
  if (c === "nw" || c === "sw") next.west = p.lng;
  else next.east = p.lng;
  if (c === "nw" || c === "ne") next.north = p.lat;
  else next.south = p.lat;
  return roundBbox(next);
}

function boxFrom(a: Point, b: Point): Bbox {
  return roundBbox({
    west: Math.min(a.lng, b.lng),
    south: Math.min(a.lat, b.lat),
    east: Math.max(a.lng, b.lng),
    north: Math.max(a.lat, b.lat),
  });
}

function pointOf(p: google.maps.LatLng | null | undefined): Point | null {
  return p ? { lat: p.lat(), lng: p.lng() } : null;
}

// The world, clockwise, with points at longitude 0 so no edge spans the
// whole globe.
const WORLD_RING: readonly Point[] = [
  { lat: 85, lng: -180 },
  { lat: 85, lng: 0 },
  { lat: 85, lng: 180 },
  { lat: -85, lng: 180 },
  { lat: -85, lng: 0 },
  { lat: -85, lng: -180 },
];

// The box, counterclockwise, so as the mask's second path it cuts a hole.
function boxRing(b: Bbox): Point[] {
  return [
    { lat: b.south, lng: b.west },
    { lat: b.south, lng: b.east },
    { lat: b.north, lng: b.east },
    { lat: b.north, lng: b.west },
  ];
}

function maskPaths(b: Bbox): Point[][] {
  return [[...WORLD_RING], boxRing(b)];
}

function boundsOf(b: Bbox): google.maps.LatLngBoundsLiteral {
  return { north: b.north, south: b.south, east: b.east, west: b.west };
}

function fieldText(v: number): string {
  return Number.isFinite(v) ? v.toFixed(4) : "";
}

// The one editor of a `{ west, south, east, north }` box (admin.md 6.29):
// a Google map on the panel's Maps key fitted to the box, with the Draw
// area toggle, four corner handles, an outline, and a mask outside the
// box; four fields in sync with the map; the minimum zoom caption; the
// rules as field errors; Export for tile builder and Copy JSON. Without
// VITE_GOOGLE_MAPS_KEY, or when the map fails to load, everything but the
// map works under a one-line note.
export default function BboxEditor({ value, onChange, exportName, help, label, error }: Props) {
  const config = useConfig();
  const compact = useCompact();
  const notify = useNotify();
  const key = config.googleMapsKey;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rectRef = useRef<google.maps.Rectangle | null>(null);
  const maskRef = useRef<google.maps.Polygon | null>(null);
  const markersRef = useRef<Partial<Record<Corner, google.maps.Marker>>>({});
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const drawingRef = useRef(false);
  const drawStartRef = useRef<Point | null>(null);
  // The last box the map itself produced; any other box refits the map.
  const fromMapRef = useRef<Bbox | null>(null);
  const [mapState, setMapState] = useState<MapState>(key ? "loading" : "unset");
  const [drawing, setDrawing] = useState(false);

  const [texts, setTexts] = useState<Record<BboxSide, string>>(() => ({
    west: fieldText(value.west),
    south: fieldText(value.south),
    east: fieldText(value.east),
    north: fieldText(value.north),
  }));
  const [maxZoom, setMaxZoom] = useState(String(EXPORT_MAX_ZOOM));
  const [terrainMaxZoom, setTerrainMaxZoom] = useState(String(EXPORT_TERRAIN_MAX_ZOOM));
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  valueRef.current = value;
  onChangeRef.current = onChange;
  drawingRef.current = drawing;

  // The fields follow the box unless the text already reads as it.
  useEffect(() => {
    setTexts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const side of BBOX_SIDES) {
        const typed = prev[side].trim() === "" ? NaN : Number(prev[side]);
        if (typed !== value[side] && !(Number.isNaN(typed) && Number.isNaN(value[side]))) {
          next[side] = fieldText(value[side]);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [value]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    const listeners: google.maps.MapsEventListener[] = [];
    const fromMap = (next: Bbox) => {
      fromMapRef.current = next;
      onChangeRef.current(next);
    };
    (async () => {
      try {
        const maps = await loadMaps(key);
        if (cancelled) return;
        const b = valueRef.current;
        const map = new maps.Map(container, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        map.fitBounds(boundsOf(b), FIT_PADDING);
        // The map is fitted to this box; only a later box refits it.
        fromMapRef.current = b;
        mapRef.current = map;
        maskRef.current = new maps.Polygon({
          map,
          paths: maskPaths(b),
          fillColor: "#000000",
          fillOpacity: 0.3,
          strokeWeight: 0,
          strokeOpacity: 0,
          clickable: false,
        });
        rectRef.current = new maps.Rectangle({
          map,
          bounds: boundsOf(b),
          strokeColor: BOX_COLOR,
          strokeOpacity: 1,
          strokeWeight: 2,
          fillOpacity: 0,
          editable: false,
          draggable: false,
          clickable: false,
        });
        const markerLib = await loadMarkers(key);
        if (cancelled) return;
        for (const corner of CORNERS) {
          const marker = new markerLib.Marker({
            map,
            position: cornerPoint(valueRef.current, corner),
            draggable: true,
            icon: HANDLE_ICON,
            title: `Drag the ${corner} corner`,
          });
          listeners.push(
            marker.addListener("drag", () => {
              const p = pointOf(marker.getPosition());
              if (p) fromMap(withCorner(valueRef.current, corner, p));
            }),
          );
          markersRef.current[corner] = marker;
        }

        const begin = (e: google.maps.MapMouseEvent) => {
          if (!drawingRef.current) return;
          drawStartRef.current = pointOf(e.latLng);
        };
        const move = (e: google.maps.MapMouseEvent) => {
          const startAt = drawStartRef.current;
          const p = pointOf(e.latLng);
          if (!drawingRef.current || startAt === null || p === null) return;
          fromMap(boxFrom(startAt, p));
        };
        const end = () => {
          drawStartRef.current = null;
        };
        for (const name of ["mousedown", "touchstart"]) listeners.push(map.addListener(name, begin));
        for (const name of ["mousemove", "touchmove"]) listeners.push(map.addListener(name, move));
        for (const name of ["mouseup", "touchend"]) listeners.push(map.addListener(name, end));
        setMapState("ready");
      } catch (e) {
        console.warn("bbox editor map:", e);
        if (!cancelled) setMapState("failed");
      }
    })();
    return () => {
      cancelled = true;
      for (const l of listeners) l.remove();
      for (const m of Object.values(markersRef.current)) m?.setMap(null);
      markersRef.current = {};
      rectRef.current?.setMap(null);
      rectRef.current = null;
      maskRef.current?.setMap(null);
      maskRef.current = null;
      mapRef.current = null;
    };
  }, [key]);

  // While drawing, a drag draws instead of panning.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    map.setOptions({ draggable: !drawing });
  }, [drawing, mapState]);

  // The mask, outline, and handles follow the box; a box the map did not
  // produce (typed, or put back by the parent) refits the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    maskRef.current?.setPaths(maskPaths(value));
    rectRef.current?.setBounds(boundsOf(value));
    for (const corner of CORNERS) markersRef.current[corner]?.setPosition(cornerPoint(value, corner));
    if (fromMapRef.current !== value && Object.keys(validateBbox(value)).length === 0) {
      map.fitBounds(boundsOf(value), FIT_PADDING);
    }
  }, [value, mapState]);

  const errors = validateBbox(value);
  const fieldError = (side: BboxSide): string | undefined => {
    const t = texts[side].trim();
    if (t === "" || !Number.isFinite(Number(t))) return "Enter a number";
    return errors[side];
  };
  const hasErrors = Object.keys(errors).length > 0;

  const doc = useMemo(
    () =>
      exportDocument(
        exportName,
        value,
        clampZoom(maxZoom, MAX_ZOOM_RANGE, EXPORT_MAX_ZOOM),
        clampZoom(terrainMaxZoom, TERRAIN_MAX_ZOOM_RANGE, EXPORT_TERRAIN_MAX_ZOOM),
      ),
    [exportName, value, maxZoom, terrainMaxZoom],
  );
  const docText = JSON.stringify(doc, null, 2);

  const onField = (side: BboxSide, text: string) => {
    setTexts((prev) => ({ ...prev, [side]: text }));
    const n = Number(text);
    if (text.trim() !== "" && Number.isFinite(n)) {
      fromMapRef.current = null;
      onChange(roundBbox({ ...value, [side]: n }));
    }
  };

  const onExport = () => {
    downloadText(docText, exportFileName(exportName), "application/json");
  };

  const onCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(docText);
      setCopyFallback(null);
      notify("Copied");
    } catch {
      setCopyFallback(docText);
    }
  };

  const note =
    mapState === "unset"
      ? "The map needs VITE_GOOGLE_MAPS_KEY, which is not set."
      : mapState === "failed"
        ? "The map could not load."
        : null;

  return (
    <Box data-testid="bbox-editor" sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        {label ? (
          <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }}>
            {label}
          </Typography>
        ) : (
          <Box sx={{ flex: 1 }} />
        )}
        {note === null ? (
          <ToggleButton
            value="draw"
            size="small"
            selected={drawing}
            onChange={() => setDrawing((d) => !d)}
            aria-label="Draw area"
            data-testid="bbox-draw"
          >
            <CropFreeIcon fontSize="small" sx={{ mr: 0.5 }} />
            Draw area
          </ToggleButton>
        ) : null}
        {help ? <HelpButton topic={help} /> : null}
      </Stack>
      {note !== null ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} data-testid="bbox-map-note">
          {note}
        </Typography>
      ) : (
        <Box
          ref={containerRef}
          data-testid="bbox-map"
          aria-label="Area map"
          sx={{
            height: compact ? 240 : 320,
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "action.hover",
            mb: 1,
            cursor: drawing ? "crosshair" : undefined,
          }}
        />
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
          gap: 1,
        }}
      >
        {BBOX_SIDES.map((side) => {
          const e = fieldError(side);
          return (
            <TextField
              key={side}
              size="small"
              type="number"
              label={FIELD_LABELS[side]}
              value={texts[side]}
              onChange={(ev) => onField(side, ev.target.value)}
              error={e !== undefined}
              helperText={e ?? " "}
              inputProps={{
                step: 0.0001,
                min: side === "west" || side === "east" ? -180 : -90,
                max: side === "west" || side === "east" ? 180 : 90,
                "data-testid": `bbox-${side}`,
              }}
            />
          );
        })}
      </Box>
      {error ? <FormHelperText error>{error}</FormHelperText> : null}
      <Typography variant="caption" color="text.secondary" component="p" data-testid="bbox-min-zoom">
        {hasErrors ? "Minimum zoom: fix the area first" : minZoomCaption(value)}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mt: 1 }}>
        <Button variant="outlined" size="small" onClick={onExport} disabled={hasErrors}>
          Export for tile builder
        </Button>
        <TextField
          size="small"
          type="number"
          label="Max zoom"
          value={maxZoom}
          onChange={(e) => setMaxZoom(e.target.value)}
          onBlur={() => setMaxZoom(String(clampZoom(maxZoom, MAX_ZOOM_RANGE, EXPORT_MAX_ZOOM)))}
          inputProps={{ min: MAX_ZOOM_RANGE.min, max: MAX_ZOOM_RANGE.max }}
          sx={{ width: 110 }}
        />
        <TextField
          size="small"
          type="number"
          label="Terrain max zoom"
          value={terrainMaxZoom}
          onChange={(e) => setTerrainMaxZoom(e.target.value)}
          onBlur={() =>
            setTerrainMaxZoom(
              String(clampZoom(terrainMaxZoom, TERRAIN_MAX_ZOOM_RANGE, EXPORT_TERRAIN_MAX_ZOOM)),
            )
          }
          inputProps={{ min: TERRAIN_MAX_ZOOM_RANGE.min, max: TERRAIN_MAX_ZOOM_RANGE.max }}
          sx={{ width: 140 }}
        />
        <Button variant="text" size="small" onClick={() => void onCopy()} disabled={hasErrors}>
          Copy JSON
        </Button>
      </Stack>
      {copyFallback !== null ? (
        <Alert severity="info" sx={{ mt: 1 }} data-testid="bbox-copy-fallback">
          <Stack spacing={1}>
            <Typography variant="body2">The clipboard is unavailable. Copy the text below.</Typography>
            <TextField
              multiline
              minRows={3}
              value={copyFallback}
              inputRef={fallbackRef}
              InputProps={{ readOnly: true }}
              inputProps={{ "aria-label": "Area JSON" }}
              fullWidth
            />
            <Box>
              <Button
                size="small"
                onClick={() => {
                  fallbackRef.current?.focus();
                  fallbackRef.current?.select();
                }}
              >
                Select
              </Button>
            </Box>
          </Stack>
        </Alert>
      ) : null}
    </Box>
  );
}
