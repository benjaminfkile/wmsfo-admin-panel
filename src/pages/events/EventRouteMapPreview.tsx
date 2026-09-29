import { useEffect, useRef, useState } from "react";
import { Alert, Box, IconButton, Stack, Tooltip } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import TerrainIcon from "@mui/icons-material/Terrain";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import { pathBounds, type LatLng } from "../../routeMap";
import { addRouteArrowImage, loadMaplibre } from "../../routeMap/poster";

interface Props {
  style: StyleSpecification;
  path: readonly LatLng[];
  // The site's map buttons the config keeps.
  fullscreenButton: boolean;
  terrainButton: boolean;
  terrainOn: boolean;
  onToggleTerrain: () => void;
}

const FIT_PADDING = 48;

// The live preview of the event's route map: a `maplibre-gl` map that
// fills its box and takes gestures directly (the scroll wheel zooms, a
// drag pans), fitted to the path when it is created and whenever the
// path changes. Every new style reaches it through setStyle, and the
// route arrowhead image is added on create. Over the map stand the
// buttons the site shows: the fullscreen button (full screen for the
// preview box) and the terrain toggle, each only while the config keeps
// it.
export default function EventRouteMapPreview({
  style,
  path,
  fullscreenButton,
  terrainButton,
  terrainOn,
  onToggleTerrain,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const appliedStyle = useRef<StyleSpecification | null>(null);
  const initial = useRef({ style, path });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    void loadMaplibre()
      .then((maplibre) => {
        if (cancelled) return;
        const bounds = pathBounds(initial.current.path);
        const map = new maplibre.Map({
          container,
          style: initial.current.style,
          interactive: true,
          attributionControl: { compact: true },
          fadeDuration: 0,
          ...(bounds ? { bounds, fitBoundsOptions: { padding: FIT_PADDING } } : {}),
        });
        addRouteArrowImage(map);
        map.on("error", (e) => {
          console.warn("route map preview:", e.error);
        });
        mapRef.current = map;
        appliedStyle.current = initial.current.style;
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
    if (!ready || !map || path === initial.current.path) return;
    const bounds = pathBounds(path);
    if (bounds) map.fitBounds(bounds, { padding: FIT_PADDING, animate: false });
  }, [ready, path]);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === boxRef.current && boxRef.current !== null);
      mapRef.current?.resize();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    const box = boxRef.current;
    if (!box) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void box.requestFullscreen?.();
  };

  if (error) {
    return (
      <Alert severity="warning" data-testid="route-map-preview-error">
        The preview could not load. {error}
      </Alert>
    );
  }

  return (
    <Box
      ref={boxRef}
      data-testid="route-map-preview"
      aria-label="Route map preview"
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "action.hover",
      }}
    >
      <Box ref={containerRef} sx={{ position: "absolute", inset: 0 }} />
      <Stack spacing={1} sx={{ position: "absolute", top: 8, right: 8 }}>
        {fullscreenButton ? (
          <Tooltip title={fullscreen ? "Exit full screen" : "Full screen"} placement="left">
            <IconButton
              size="small"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              data-testid="route-map-preview-fullscreen"
              sx={{ bgcolor: "background.paper", boxShadow: 1, "&:hover": { bgcolor: "background.paper" } }}
            >
              {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : null}
        {terrainButton ? (
          <Tooltip title={terrainOn ? "Hide terrain" : "Show terrain"} placement="left">
            <IconButton
              size="small"
              onClick={onToggleTerrain}
              aria-label="Terrain"
              aria-pressed={terrainOn}
              data-testid="route-map-preview-terrain"
              color={terrainOn ? "primary" : "default"}
              sx={{ bgcolor: "background.paper", boxShadow: 1, "&:hover": { bgcolor: "background.paper" } }}
            >
              <TerrainIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
    </Box>
  );
}
