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
import type {
  GeoJSONSource,
  GeoJSONSourceSpecification,
  LngLat,
  Map as MaplibreMap,
  MapMouseEvent,
  MapTouchEvent,
  Marker,
  StyleSpecification,
} from "maplibre-gl";
import { useConfig } from "../../ConfigContext";
import { useCompact } from "../../hooks/useCompact";
import { useNotify } from "../../hooks/useNotify";
import { downloadText } from "../../lib/download";
import HelpButton from "../../help/HelpButton";
import type { HelpKey } from "../../help/helpKeys";
import { applyDevBasemap, glyphsUrl, routeBasemapBase } from "../../routeMap";
import { loadMaplibre } from "../../routeMap/poster";
import routeLight from "../../../contracts/fixtures/themes/route-light.json";
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
const MASK_SOURCE = "bbox-mask";
const BOX_SOURCE = "bbox-box";

type Corner = "nw" | "ne" | "sw" | "se";
const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

type FeatureData = Exclude<GeoJSONSourceSpecification["data"], string>;

type MapState = "unset" | "loading" | "ready" | "failed";

function cornerPoint(b: Bbox, c: Corner): [number, number] {
  return [c === "nw" || c === "sw" ? b.west : b.east, c === "nw" || c === "ne" ? b.north : b.south];
}

function withCorner(b: Bbox, c: Corner, p: LngLat): Bbox {
  const next = { ...b };
  if (c === "nw" || c === "sw") next.west = p.lng;
  else next.east = p.lng;
  if (c === "nw" || c === "ne") next.north = p.lat;
  else next.south = p.lat;
  return roundBbox(next);
}

function boxFrom(a: LngLat, b: LngLat): Bbox {
  return roundBbox({
    west: Math.min(a.lng, b.lng),
    south: Math.min(a.lat, b.lat),
    east: Math.max(a.lng, b.lng),
    north: Math.max(a.lat, b.lat),
  });
}

function ring(b: Bbox): [number, number][] {
  return [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ];
}

// The world with the box cut out, shaded outside the box.
function maskData(b: Bbox): FeatureData {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-180, -85],
          [180, -85],
          [180, 85],
          [-180, 85],
          [-180, -85],
        ],
        ring(b).reverse(),
      ],
    },
  };
}

function boxData(b: Bbox): FeatureData {
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring(b)] } };
}

function boundsOf(b: Bbox): [[number, number], [number, number]] {
  return [
    [b.west, b.south],
    [b.east, b.north],
  ];
}

// The `route-light` seed over the dev basemap, with the basemap's glyphs
// when the body names none, so its labels draw.
function editorStyle(config: { routeBasemapUrl: string }): StyleSpecification {
  const style = applyDevBasemap(routeLight as unknown as StyleSpecification, config);
  const base = routeBasemapBase(config);
  return style.glyphs || base === null ? style : { ...style, glyphs: glyphsUrl(base) };
}

function fieldText(v: number): string {
  return Number.isFinite(v) ? v.toFixed(4) : "";
}

// The one editor of a `{ west, south, east, north }` box (admin.md 6.29):
// a map over the dev basemap fitted to the box, with the Draw area
// toggle, four corner handles, and a mask outside the box; four fields in
// sync with the map; the minimum zoom caption; the rules as field errors;
// Export for tile builder and Copy JSON. Without VITE_ROUTE_BASEMAP_URL,
// or when the map fails to load, everything but the map works under a
// one-line note.
export default function BboxEditor({ value, onChange, exportName, help, label, error }: Props) {
  const config = useConfig();
  const compact = useCompact();
  const notify = useNotify();
  const base = routeBasemapBase(config);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Partial<Record<Corner, Marker>>>({});
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const drawingRef = useRef(false);
  const drawStartRef = useRef<LngLat | null>(null);
  // The last box the map itself produced; any other box refits the map.
  const fromMapRef = useRef<Bbox | null>(null);
  const initialRef = useRef(value);
  const [mapState, setMapState] = useState<MapState>(base === null ? "unset" : "loading");
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
    if (base === null) return;
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    const fromMap = (next: Bbox) => {
      fromMapRef.current = next;
      onChangeRef.current(next);
    };
    void loadMaplibre()
      .then((maplibre) => {
        if (cancelled) return;
        const start = initialRef.current;
        const map = new maplibre.Map({
          container,
          style: editorStyle(config),
          bounds: boundsOf(start),
          fitBoundsOptions: { padding: FIT_PADDING },
          attributionControl: { compact: true },
          fadeDuration: 0,
        });
        mapRef.current = map;
        map.on("error", (e: { error?: unknown }) => {
          console.warn("bbox editor map:", e.error);
        });
        map.on("load", () => {
          if (cancelled) return;
          const b = valueRef.current;
          map.addSource(MASK_SOURCE, { type: "geojson", data: maskData(b) });
          map.addSource(BOX_SOURCE, { type: "geojson", data: boxData(b) });
          map.addLayer({
            id: MASK_SOURCE,
            type: "fill",
            source: MASK_SOURCE,
            paint: { "fill-color": "#000000", "fill-opacity": 0.3 },
          });
          map.addLayer({
            id: BOX_SOURCE,
            type: "line",
            source: BOX_SOURCE,
            paint: { "line-color": "#1a56c4", "line-width": 2 },
          });
          for (const corner of CORNERS) {
            const el = document.createElement("div");
            el.setAttribute("aria-label", `Drag the ${corner} corner`);
            Object.assign(el.style, {
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "#ffffff",
              border: "3px solid #1a56c4",
              boxSizing: "border-box",
              cursor: "move",
            });
            const marker = new maplibre.Marker({ element: el, draggable: true })
              .setLngLat(cornerPoint(b, corner))
              .addTo(map);
            marker.on("drag", () => {
              fromMap(withCorner(valueRef.current, corner, marker.getLngLat()));
            });
            markersRef.current[corner] = marker;
          }
          setMapState("ready");
        });

        const begin = (e: MapMouseEvent | MapTouchEvent) => {
          if (!drawingRef.current) return;
          e.preventDefault();
          drawStartRef.current = e.lngLat;
        };
        const move = (e: MapMouseEvent | MapTouchEvent) => {
          const startAt = drawStartRef.current;
          if (!drawingRef.current || startAt === null) return;
          fromMap(boxFrom(startAt, e.lngLat));
        };
        const end = () => {
          drawStartRef.current = null;
        };
        map.on("mousedown", begin);
        map.on("touchstart", begin);
        map.on("mousemove", move);
        map.on("touchmove", move);
        map.on("mouseup", end);
        map.on("touchend", end);
      })
      .catch((e: unknown) => {
        console.warn("bbox editor map:", e);
        if (!cancelled) setMapState("failed");
      });
    return () => {
      cancelled = true;
      for (const m of Object.values(markersRef.current)) m?.remove();
      markersRef.current = {};
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; the box reaches it through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // While drawing, a drag draws instead of panning.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    if (drawing) {
      map.dragPan.disable();
      map.touchZoomRotate.disable();
    } else {
      map.dragPan.enable();
      map.touchZoomRotate.enable();
    }
  }, [drawing, mapState]);

  // The mask, outline, and handles follow the box; a box the map did not
  // produce (typed, or put back by the parent) refits the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    (map.getSource(MASK_SOURCE) as GeoJSONSource | undefined)?.setData(maskData(value));
    (map.getSource(BOX_SOURCE) as GeoJSONSource | undefined)?.setData(boxData(value));
    for (const corner of CORNERS) markersRef.current[corner]?.setLngLat(cornerPoint(value, corner));
    if (fromMapRef.current !== value && Object.keys(validateBbox(value)).length === 0) {
      map.fitBounds(boundsOf(value), { padding: FIT_PADDING, animate: false });
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
      ? "The map needs VITE_ROUTE_BASEMAP_URL, which is not set."
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
