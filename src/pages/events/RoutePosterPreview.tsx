import { useEffect, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import { pathBounds, type LatLng } from "../../routeMap";
import {
  addRouteArrowImage,
  loadMaplibre,
  posterCssSize,
  posterFitPadding,
  type PosterSize,
} from "../../routeMap/poster";

interface Props {
  style: StyleSpecification;
  path: readonly LatLng[];
  size: PosterSize;
}

// The tallest the preview grows, in CSS pixels.
export const PREVIEW_MAX_HEIGHT = 360;
// The width used until the preview box has been measured.
const FALLBACK_WIDTH = 480;

// The live preview of the poster. The map is laid out at the CSS size of
// the export render and scaled down to fit the dialog, with its pixel
// ratio lowered to match, so zoom, line widths, arrows, and label
// placement are the ones the export draws. Every new style goes to the
// map through setStyle; a size change resizes the map and fits the path
// again with the export's padding. The map takes no input.
export default function RoutePosterPreview({ style, path, size }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const appliedStyle = useRef<StyleSpecification | null>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const css = posterCssSize(size);
  const displayWidth = Math.min(width, (PREVIEW_MAX_HEIGHT * size.width) / size.height);
  const scale = displayWidth / css.width;
  const displayHeight = css.height * scale;
  const pixelRatio = scale * (window.devicePixelRatio || 1);

  // The values the map is created with; later changes reach it through
  // the effects below.
  const initial = useRef({ style, path, size, pixelRatio });

  useEffect(() => {
    let cancelled = false;
    const container = innerRef.current;
    if (!container) return;
    void loadMaplibre()
      .then((maplibre) => {
        if (cancelled) return;
        const { style: first, path: firstPath, size: firstSize, pixelRatio: ratio } = initial.current;
        const bounds = pathBounds(firstPath);
        const map = new maplibre.Map({
          container,
          style: first,
          interactive: false,
          attributionControl: false,
          pixelRatio: ratio,
          fadeDuration: 0,
          ...(bounds ? { bounds, fitBoundsOptions: { padding: posterFitPadding(firstSize) } } : {}),
        });
        addRouteArrowImage(map);
        map.on("error", (e) => {
          console.warn("route poster preview:", e.error);
        });
        mapRef.current = map;
        appliedStyle.current = first;
        setReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error && e.message ? e.message : "The preview could not load.");
        }
      });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || appliedStyle.current === style) return;
    appliedStyle.current = style;
    map.setStyle(style);
  }, [ready, style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setPixelRatio(pixelRatio);
    map.resize();
    const bounds = pathBounds(path);
    if (bounds) map.fitBounds(bounds, { padding: posterFitPadding(size), animate: false });
  }, [ready, path, size, pixelRatio]);

  return (
    <Box ref={outerRef} sx={{ width: "100%" }}>
      {error ? (
        <Alert severity="warning" data-testid="route-poster-preview-error">
          The preview could not load. {error}
        </Alert>
      ) : (
        <Box
          data-testid="route-poster-preview"
          aria-label="Poster preview"
          role="img"
          sx={{
            position: "relative",
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            overflow: "hidden",
            borderRadius: 1,
            bgcolor: "action.hover",
          }}
        >
          <Box
            ref={innerRef}
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              width: `${css.width}px`,
              height: `${css.height}px`,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              pointerEvents: "none",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
