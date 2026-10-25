import { useMemo } from "react";
import {
  Box,
  Button,
  FormHelperText,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { maps as mapsApi } from "../../api/resources/maps";
import { siteSettings as siteSettingsApi } from "../../api/resources/siteSettings";
import { keys } from "../../queries/keys";
import BboxEditor from "../bbox/BboxEditor";
import { siteDefaultBbox } from "../bbox/bbox";
import HelpButton from "../../help/HelpButton";
import type { HelpKey } from "../../help/helpKeys";
import { findMap, mapArea, readyMaps, terrainWord, type TrackerArea } from "./trackerArea";

interface Props {
  value: TrackerArea;
  onChange: (next: TrackerArea) => void;
  // The box editor's export name.
  exportName: string;
  // The help topics of the box editor and of the map select.
  bboxHelp?: HelpKey;
  mapHelp?: HelpKey;
  // Server errors at `trackerBbox` and `trackerMapId`.
  bboxError?: string | null;
  mapError?: string | null;
}

// The one map choice of an event (admin.md 6.3, 7.2), in the create
// dialog, the Tracker map card, and the clone dialog: the Map select
// ("No map" and every ready map by name with its terrain word) above the
// box editor. Picking a map sets the box to the map's area, and the
// editor keeps the box inside it; picking another map resets the box to
// that map's area. "No map" keeps the current box and lifts the limit,
// with "Use site default" to put the site settings box back.
export default function TrackerAreaField({
  value,
  onChange,
  exportName,
  bboxHelp,
  mapHelp,
  bboxError,
  mapError,
}: Props) {
  const mapsQ = useQuery({ queryKey: keys.maps, queryFn: () => mapsApi.list() });
  const settingsQ = useQuery({
    queryKey: keys.siteSettings,
    queryFn: () => siteSettingsApi.get(),
  });

  const all = mapsQ.data?.items;
  const chosen = findMap(all, value.mapId);
  // A chosen map that is no longer ready stays listed so the select can
  // show it.
  const options = useMemo(() => {
    const ready = readyMaps(all);
    return chosen && !ready.includes(chosen) ? [...ready, chosen] : ready;
  }, [all, chosen]);
  const outer = mapArea(chosen);

  const pick = (raw: string) => {
    if (raw === "") {
      onChange({ mapId: null, bbox: value.bbox });
      return;
    }
    const id = Number(raw);
    if (id === value.mapId) return;
    const area = mapArea(findMap(all, id));
    onChange({ mapId: id, bbox: area ?? value.bbox });
  };

  // Until the maps load, a chosen map has no option to show.
  const selectValue = value.mapId === null || chosen === null ? "" : String(value.mapId);

  return (
    <Box data-testid="tracker-area-field">
      <Stack direction="row" spacing={0.5} alignItems="flex-start">
        <TextField
          select
          fullWidth
          label="Map"
          value={selectValue}
          onChange={(e) => pick(e.target.value)}
          disabled={value.mapId !== null && chosen === null}
          error={!!mapError}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "data-testid": "tracker-map-select" }}
        >
          <MenuItem value="">No map</MenuItem>
          {options.map((m) => (
            <MenuItem key={String(m.id)} value={String(m.id)}>
              <ListItemText primary={m.name} secondary={terrainWord(m)} />
            </MenuItem>
          ))}
        </TextField>
        {mapHelp ? (
          <Box sx={{ pt: 1 }}>
            <HelpButton topic={mapHelp} />
          </Box>
        ) : null}
      </Stack>
      {mapError ? <FormHelperText error>{mapError}</FormHelperText> : null}
      <FormHelperText data-testid="tracker-map-note" sx={{ mb: 2 }}>
        {value.mapId === null
          ? "No map: every viewer gets Google Maps, locked to the box. Draw the area freely."
          : "Viewers whose browser can draw this map get it; the rest get Google Maps, locked to the box. The area stays inside the map's area."}
      </FormHelperText>
      <BboxEditor
        label="Tracker area"
        value={value.bbox}
        onChange={(bbox) => onChange({ mapId: value.mapId, bbox })}
        exportName={exportName}
        help={bboxHelp}
        error={bboxError}
        outer={outer}
        outerName={chosen?.name ?? undefined}
      />
      {value.mapId === null ? (
        <Button
          size="small"
          sx={{ mt: 1 }}
          onClick={() =>
            onChange({ mapId: null, bbox: siteDefaultBbox(settingsQ.data?.data) })
          }
        >
          Use site default
        </Button>
      ) : null}
    </Box>
  );
}
