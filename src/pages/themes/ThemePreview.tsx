import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Alert, Box, Stack, Typography } from "@mui/material";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";

type Maplibre = typeof import("maplibre-gl");
import { useConfig } from "../../ConfigContext";
import { useCompact } from "../../hooks/useCompact";
import { applyDevBasemap, routeBasemapBase } from "../../routeMap";
import { addRouteArrowImage, loadMaplibre } from "../../routeMap/poster";
import { loadMaps } from "../places/googleMaps";
import type { Chrome, Overlay } from "../../api/resources/themes";
import ChromeStrip from "./ChromeStrip";
import { PREVIEW_VIEWS, previewStyle, samplePath, type PreviewView } from "./previewStyle";
import type { Renderer } from "./styleCheck";

// Captures the first MapLibre view to a PNG blob.
export type CaptureThumbnail = () => Promise<Blob>;

interface Props {
  renderer: Renderer;
  // The parsed style body, or null while there is none to show.
  style: unknown;
  chrome: Chrome;
  overlay: Overlay;
  // Set to the capture of the first view while a MapLibre preview is up.
  captureRef?: RefObject<CaptureThumbnail | null>;
}

export const BASEMAP_NOTE =
  "The theme preview needs VITE_ROUTE_BASEMAP_URL, which is not set.";
export const GOOGLE_KEY_NOTE =
  "The theme preview needs VITE_GOOGLE_MAPS_KEY, which is not set.";

const PANE_HEIGHT = 280;

// The theme preview (admin.md 6.28): the style as the tracker draws it.
// MapLibre shows two non-interactive maps over the dev basemap, the
// valley at zoom 11 and the city at zoom 14, with the sample route, its
// arrows, three time labels, and the user marker in the overlay colours;
// Google shows one map through the places loader with the array as its
// `styles` and the sample route as a Polyline. The chrome strip sits at
// the bottom edge of every map.
export default function ThemePreview({ renderer, style, chrome, overlay, captureRef }: Props) {
  const config = useConfig();
  const compact = useCompact();
  const base = routeBasemapBase(config);

  const mapStyle = useMemo(() => {
    if (renderer !== "maplibre" || base === null || style === null) return null;
    const body = applyDevBasemap(style as StyleSpecification, config);
    return previewStyle(body, overlay, base);
  }, [renderer, base, style, overlay, config]);

  // maplibre-gl, loaded once for both views while there is a map to draw.
  const wantsMaplibre = mapStyle !== null;
  const [maplibre, setMaplibre] = useState<Maplibre | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    if (!wantsMaplibre || maplibre !== null) return;
    let cancelled = false;
    loadMaplibre()
      .then((m) => {
        if (!cancelled) setMaplibre(m);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error && e.message ? e.message : "The map could not load.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wantsMaplibre, maplibre]);

  let body;
  if (style === null) {
    body = (
      <Typography variant="body2" color="text.secondary" data-testid="theme-preview-empty">
        Choose a style file to see the preview.
      </Typography>
    );
  } else if (renderer === "google") {
    body = config.googleMapsKey ? (
      <Pane label="Google Maps preview" chrome={chrome}>
        <GoogleView styles={style as google.maps.MapTypeStyle[]} overlay={overlay} apiKey={config.googleMapsKey} />
      </Pane>
    ) : (
      <Alert severity="info" data-testid="theme-preview-note">
        {GOOGLE_KEY_NOTE}
      </Alert>
    );
  } else if (mapStyle === null) {
    body = (
      <Alert severity="info" data-testid="theme-preview-note">
        {BASEMAP_NOTE}
      </Alert>
    );
  } else if (loadError !== null) {
    body = (
      <Alert severity="warning" data-testid="theme-preview-error">
        The preview could not load. {loadError}
      </Alert>
    );
  } else if (maplibre === null) {
    body = (
      <Typography variant="body2" color="text.secondary">
        Loading the preview
      </Typography>
    );
  } else {
    body = (
      <Stack direction={compact ? "column" : "row"} spacing={1}>
        {PREVIEW_VIEWS.map((view, i) => (
          <Pane key={view.label} label={view.label} chrome={chrome}>
            <MaplibreView
              maplibre={maplibre}
              view={view}
              style={mapStyle}
              captureRef={i === 0 ? captureRef : undefined}
            />
          </Pane>
        ))}
      </Stack>
    );
  }

  return (
    <Box data-testid="theme-preview" data-renderer={renderer}>
      {body}
    </Box>
  );
}

function Pane({
  label,
  chrome,
  children,
}: {
  label: string;
  chrome: Chrome;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box
        aria-label={label}
        sx={{
          position: "relative",
          height: PANE_HEIGHT,
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "action.hover",
        }}
      >
        {children}
        <ChromeStrip chrome={chrome} />
      </Box>
    </Box>
  );
}

function MaplibreView({
  maplibre,
  view,
  style,
  captureRef,
}: {
  maplibre: Maplibre;
  view: PreviewView;
  style: StyleSpecification;
  captureRef?: RefObject<CaptureThumbnail | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const initialStyle = useRef(style);
  const applied = useRef<StyleSpecification | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    try {
      const map = new maplibre.Map({
        container,
        style: initialStyle.current,
        center: view.center,
        zoom: view.zoom,
        interactive: false,
        attributionControl: { compact: true },
        fadeDuration: 0,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      addRouteArrowImage(map);
      map.on("error", (e: { error?: unknown }) => {
        console.warn("theme preview:", e.error);
      });
      mapRef.current = map;
      applied.current = initialStyle.current;
      if (captureRef) {
        captureRef.current = () =>
          new Promise<Blob>((resolve, reject) => {
            const run = () => {
              map.getCanvas().toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("The preview could not be captured."));
              }, "image/png");
            };
            if (map.loaded()) run();
            else map.once("idle", run);
          });
      }
      setReady(true);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The map could not load.");
    }
    return () => {
      if (captureRef) captureRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [maplibre, view, captureRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || applied.current === style) return;
    applied.current = style;
    map.setStyle(style);
  }, [ready, style]);

  if (error) {
    return (
      <Alert severity="warning" data-testid="theme-preview-error">
        The preview could not load. {error}
      </Alert>
    );
  }
  return (
    <Box
      ref={containerRef}
      data-testid={`theme-preview-map-${view.zoom}`}
      sx={{ position: "absolute", inset: 0 }}
    />
  );
}

// Google colours take no alpha channel.
function opaque(colour: string): string {
  return colour.slice(0, 7);
}

function GoogleView({
  styles,
  overlay,
  apiKey,
}: {
  styles: google.maps.MapTypeStyle[];
  overlay: Overlay;
  apiKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const initial = useRef({ styles, overlay });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    loadMaps(apiKey)
      .then((lib) => {
        if (cancelled) return;
        const path = samplePath();
        const map = new lib.Map(container, {
          center: { lat: 46.868, lng: -113.995 },
          zoom: 13,
          styles: initial.current.styles,
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
          clickableIcons: false,
        });
        const o = initial.current.overlay;
        lineRef.current = new lib.Polyline({
          map,
          path,
          strokeColor: opaque(o.routeColor),
          strokeOpacity: o.routeOpacity,
          strokeWeight: 5,
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error && e.message ? e.message : "The map could not load.");
        }
      });
    return () => {
      cancelled = true;
      lineRef.current?.setMap(null);
      lineRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.setOptions({ styles });
  }, [ready, styles]);

  useEffect(() => {
    if (!ready) return;
    lineRef.current?.setOptions({
      strokeColor: opaque(overlay.routeColor),
      strokeOpacity: overlay.routeOpacity,
    });
  }, [ready, overlay]);

  if (error) {
    return (
      <Alert severity="warning" data-testid="theme-preview-error">
        The preview could not load. {error}
      </Alert>
    );
  }
  return (
    <Box ref={containerRef} data-testid="theme-preview-google" sx={{ position: "absolute", inset: 0 }} />
  );
}
