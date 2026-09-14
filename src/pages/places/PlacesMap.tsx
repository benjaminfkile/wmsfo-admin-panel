import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  places as placesApi,
  type PlaceMapQuery,
} from "../../api/resources/places";
import { events as eventsApi } from "../../api/resources/events";
import { keys } from "../../queries/keys";
import { useConfig } from "../../ConfigContext";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import type { PlacePin } from "../../api/types";
import { loadMaps, loadMarkers } from "./googleMaps";

// admin.md 6.24 /places/map: event select (default the current event),
// window select (this event / last 14 days / all time), Google map
// centred on the pins' bounds, one marker per pinned place sized by the
// people count (a circle with the count inside), a tooltip listing the
// codes with their counts, a side list of every place with scans in
// the window, plus the unpinned places and unattached codes' counts.

type Window = "event" | "days14" | "all";

const CIRCLE_MIN = 24;
const CIRCLE_MAX = 72;

export function circleSizeFor(people: number, maxPeople: number): number {
  if (maxPeople <= 0) return CIRCLE_MIN;
  const t = Math.sqrt(people) / Math.sqrt(maxPeople);
  return Math.round(CIRCLE_MIN + t * (CIRCLE_MAX - CIRCLE_MIN));
}

export default function PlacesMap() {
  const config = useConfig();
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerLibRef = useRef<google.maps.MarkerLibrary | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const eventsQ = useQuery({
    queryKey: keys.events,
    queryFn: () => eventsApi.list(),
  });

  const defaultEventId = useMemo<number | "all">(() => {
    const items = eventsQ.data?.items ?? [];
    const current = items.find((e) => e.isCurrent);
    return current ? Number(current.id) : "all";
  }, [eventsQ.data]);

  const [eventId, setEventId] = useState<number | "all">("all");
  const [window, setWindow] = useState<Window>("event");

  useEffect(() => {
    if (defaultEventId !== "all" && eventId === "all") {
      setEventId(defaultEventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEventId]);

  const query = useMemo<PlaceMapQuery>(() => {
    const q: PlaceMapQuery = {};
    if (eventId !== "all") q.eventId = Number(eventId);
    if (window === "days14") {
      const from = new Date();
      from.setDate(from.getDate() - 14);
      q.from = from.toISOString();
    }
    return q;
  }, [eventId, window]);

  const mapQ = useQuery({
    queryKey: ["places", "map", query] as const,
    queryFn: () => placesApi.map(query),
  });

  const pins = useMemo<PlacePin[]>(
    () => mapQ.data?.items ?? [],
    [mapQ.data],
  );
  const maxPeople = pins.reduce((m, p) => Math.max(m, p.people), 0);

  useEffect(() => {
    let cancelled = false;
    const div = mapDiv.current;
    if (!div) return;
    (async () => {
      try {
        const maps = await loadMaps(config.googleMapsKey);
        if (cancelled) return;
        const map = new maps.Map(div, {
          center: { lat: 46.916, lng: -114.039 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        markerLibRef.current = await loadMarkers(config.googleMapsKey);
        if (cancelled) return;
        setMapReady(true);
      } catch (e) {
        if (!cancelled)
          setMapError(e instanceof Error ? e.message : "Map failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.googleMapsKey]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    if (!map || !mapReady || !markerLib) return;
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    if (pins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const pin of pins) {
      const size = circleSizeFor(pin.people, maxPeople);
      const tooltip = pin.codes
        .map((c) => `${c.tag}: ${c.people}`)
        .join(", ");
      const marker = new markerLib.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map,
        title: tooltip,
        label: {
          text: String(pin.people),
          color: "#fff",
          fontWeight: "600",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: size / 2,
          fillColor: "#1976d2",
          fillOpacity: 0.85,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: pin.lat, lng: pin.lng });
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds);
  }, [pins, maxPeople, mapReady]);

  return (
    <>
      <PageHeader
        title="Places map"
        actions={
          <Button component={RouterLink} to="/places">
            Back to list
          </Button>
        }
      />

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 220 } }}>
          <InputLabel id="places-map-event">Event</InputLabel>
          <Select
            labelId="places-map-event"
            label="Event"
            value={String(eventId)}
            onChange={(e) => {
              const v = e.target.value;
              setEventId(v === "all" ? "all" : Number(v));
            }}
          >
            <MenuItem value="all">All events</MenuItem>
            {(eventsQ.data?.items ?? []).map((e) => (
              <MenuItem key={String(e.id)} value={String(e.id)}>
                {e.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 220 } }}>
          <InputLabel id="places-map-window">Window</InputLabel>
          <Select
            labelId="places-map-window"
            label="Window"
            value={window}
            onChange={(e) => setWindow(e.target.value as Window)}
          >
            <MenuItem value="event">This event</MenuItem>
            <MenuItem value="days14">Last 14 days</MenuItem>
            <MenuItem value="all">All time</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {mapQ.error ? <ErrorAlert error={mapQ.error} /> : null}
      {mapError ? <Alert severity="warning">{mapError}</Alert> : null}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper sx={{ flex: 2, p: 1, minHeight: 480 }}>
          <Box
            ref={mapDiv}
            data-testid="places-map-container"
            sx={{ width: "100%", height: 480 }}
          />
        </Paper>

        <Card sx={{ flex: 1, minWidth: { xs: "100%", sm: 260 }, maxWidth: "100%" }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Places in this window
            </Typography>
            <List dense data-testid="places-map-list">
              {pins.map((p: PlacePin) => (
                <ListItem key={String(p.placeId)} disableGutters>
                  <ListItemText
                    primary={p.path.join(" › ")}
                    secondary={`${p.people} people · ${p.codes
                      .map((c) => `${c.tag} (${c.people})`)
                      .join(", ")}`}
                  />
                </ListItem>
              ))}
            </List>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                Unpinned places with scans: {mapQ.data?.unpinned ?? 0}
              </Typography>
              <Typography variant="body2">
                Unattached codes with scans: {mapQ.data?.unattached ?? 0}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}
