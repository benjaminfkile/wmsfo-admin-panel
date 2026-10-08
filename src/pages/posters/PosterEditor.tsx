import { useState } from "react";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { posters as postersApi } from "../../api/resources/posters";
import { routes as routesApi } from "../../api/resources/routes";
import type { Poster } from "../../api/types";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import { useConfig } from "../../ConfigContext";
import { useNotify } from "../../hooks/useNotify";
import { keys } from "../../queries/keys";
import { routeBasemapBase } from "../../routeMap";
import {
  DEFAULT_DESIGN,
  parsePosterLayout,
  toLayoutDocument,
  type PosterLayout,
} from "../../routeMap/posterLayout";
import PosterStudioWorkspace from "./PosterStudioWorkspace";

export const NO_RECORDING_HINT = "Choose a flight recording to draw the poster's map.";
export const NO_BASEMAP_HINT =
  "Poster generation needs VITE_ROUTE_BASEMAP_URL, which is not set.";
export const NAME_REQUIRED = "The poster needs a name.";

// The poster editor, /posters/:id (admin.md 6.3, Poster studio). It reads
// the poster and opens the studio workspace on the design its layout
// document holds.
export default function PosterEditor() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const posterQ = useQuery({
    queryKey: keys.poster(id),
    queryFn: () => postersApi.get(id),
    enabled: Number.isFinite(id),
  });

  if (posterQ.isLoading) {
    return <Typography>Loading…</Typography>;
  }
  if (posterQ.error || !posterQ.data) {
    return <ErrorAlert error={posterQ.error ?? new Error("Poster not found")} />;
  }
  return <PosterEditorBody key={id} poster={posterQ.data} />;
}

// The header holds the editable name, the Flight recording picker, Save,
// and the way back to the list. The poster's layout is read once, when
// the page opens; the workspace reports every change of the design and
// Save sends the name, the recording, and the whole layout document.
// While no recording is chosen, or the basemap URL is unset, a hint
// stands in place of the workspace; the design survives the switch.
function PosterEditorBody({ poster }: { poster: Poster }) {
  const id = Number(poster.id);
  const config = useConfig();
  const qc = useQueryClient();
  const notify = useNotify();
  const [name, setName] = useState(poster.name ?? "");
  const [routeId, setRouteId] = useState<number | null>(
    poster.routeId === null || poster.routeId === undefined ? null : Number(poster.routeId),
  );
  const [layout, setLayout] = useState<PosterLayout>(
    () => parsePosterLayout(poster.layout) ?? toLayoutDocument(DEFAULT_DESIGN, []),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const routesQ = useQuery({ queryKey: keys.routes, queryFn: () => routesApi.list() });
  const recordings = routesQ.data?.items ?? [];
  const unknownRecording =
    routeId !== null && routesQ.isSuccess && !recordings.some((r) => Number(r.id) === routeId);

  const trimmed = name.trim();

  // PATCHes the name, the recording, and `next`; resolves whether it was
  // saved.
  const save = async (next: PosterLayout): Promise<boolean> => {
    setSaveError(null);
    if (!trimmed) {
      setSaveError(NAME_REQUIRED);
      return false;
    }
    setSaving(true);
    try {
      const saved = await postersApi.patch(id, { name: trimmed, routeId, layout: next });
      qc.setQueryData(keys.poster(id), saved);
    } catch (e) {
      setSaveError(`The poster could not be saved. ${e instanceof Error && e.message ? e.message : "Unknown error."}`);
      return false;
    } finally {
      setSaving(false);
    }
    void qc.invalidateQueries({ queryKey: keys.posters, exact: true });
    return true;
  };

  const hint =
    routeId === null ? NO_RECORDING_HINT : routeBasemapBase(config) === null ? NO_BASEMAP_HINT : null;

  return (
    <>
      <PageHeader
        title="Poster studio"
        help="posters.editor"
        subtitle={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              size="small"
              required
              value={name}
              error={!trimmed}
              helperText={!trimmed ? NAME_REQUIRED : undefined}
              onChange={(e) => setName(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 200, "data-testid": "poster-name" } }}
              sx={{ minWidth: { sm: 280 } }}
            />
            <TextField
              select
              label="Flight recording"
              size="small"
              value={routeId === null ? "" : String(routeId)}
              onChange={(e) => setRouteId(e.target.value === "" ? null : Number(e.target.value))}
              slotProps={{
                select: { displayEmpty: true },
                inputLabel: { shrink: true },
              }}
              sx={{ minWidth: { sm: 280 } }}
            >
              <MenuItem value="">No recording</MenuItem>
              {unknownRecording ? (
                <MenuItem value={String(routeId)}>{`#${routeId}`}</MenuItem>
              ) : null}
              {recordings.map((r) => (
                <MenuItem key={String(r.id)} value={String(r.id)}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        }
        actions={
          <>
            <Button component={RouterLink} to="/posters" data-testid="poster-back">
              Back to posters
            </Button>
            <Button
              variant="contained"
              disabled={saving || !trimmed}
              onClick={() => {
                void save(layout).then((saved) => {
                  if (saved) notify("Poster saved");
                });
              }}
              data-testid="poster-save"
            >
              Save
            </Button>
          </>
        }
      />
      {routesQ.error ? <ErrorAlert error={routesQ.error} /> : null}
      {saveError ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="poster-save-error">
          {saveError}
        </Alert>
      ) : null}
      {hint || routeId === null ? (
        <Alert severity="info" data-testid="poster-studio-hint">
          {hint}
        </Alert>
      ) : (
        <PosterStudioWorkspace
          posterName={trimmed || (poster.name ?? "")}
          routeId={routeId}
          initialLayout={layout}
          onLayoutChange={setLayout}
          onSave={save}
        />
      )}
    </>
  );
}
