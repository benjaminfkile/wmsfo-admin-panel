import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { places as placesApi } from "../../api/resources/places";
import { qr as qrApi } from "../../api/resources/qr";
import { pages as pagesApi } from "../../api/resources/pages";
import { keys } from "../../queries/keys";
import { useConfig } from "../../ConfigContext";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import { useNotify } from "../../hooks/useNotify";
import type { Place } from "../../api/types";
import LocationCard from "./LocationCard";

type OpensChoice = "place" | "page" | "url";

export default function PlaceDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const notify = useNotify();
  const config = useConfig();

  const listQ = useQuery({
    queryKey: keys.places,
    queryFn: () => placesApi.list(),
  });

  const codesQ = useQuery({
    queryKey: keys.qrCodes,
    queryFn: () => qrApi.list(),
  });

  const pagesQ = useQuery({
    queryKey: keys.pages,
    queryFn: () => pagesApi.list(),
  });

  const place = useMemo<Place | undefined>(
    () => listQ.data?.items.find((p) => p.id === id),
    [listQ.data, id],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  const [opensChoice, setOpensChoice] = useState<OpensChoice>("place");
  const [opensPageId, setOpensPageId] = useState<number | "">("");
  const [forwardUrl, setForwardUrl] = useState("");
  const [attachCodeId, setAttachCodeId] = useState<number | "">("");

  useEffect(() => {
    if (!place) return;
    setName(place.name);
    setDescription(place.description);
    setParentId(place.parentId);
    if (place.opensPageId != null) {
      setOpensChoice("page");
      setOpensPageId(place.opensPageId);
      setForwardUrl("");
    } else if (place.forwardUrl) {
      setOpensChoice("url");
      setForwardUrl(place.forwardUrl);
      setOpensPageId("");
    } else {
      setOpensChoice("place");
      setOpensPageId("");
      setForwardUrl("");
    }
  }, [place]);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: keys.places });
    void qc.invalidateQueries({ queryKey: keys.qrCodes });
  };

  const patchMut = useMutation({
    mutationFn: (body: Parameters<typeof placesApi.patch>[1]) =>
      placesApi.patch(id, body),
    onSuccess: () => {
      notify("Saved");
      invalidateAll();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Patch failed", "error"),
  });

  const attachMut = useMutation({
    mutationFn: (codeId: number) => qrApi.attach(codeId, { placeId: id }),
    onSuccess: () => {
      notify("Attached");
      invalidateAll();
      setAttachCodeId("");
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Attach failed", "error"),
  });

  const detachMut = useMutation({
    mutationFn: (codeId: number) => qrApi.detach(codeId),
    onSuccess: () => {
      notify("Detached");
      invalidateAll();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Detach failed", "error"),
  });

  const pinMut = useMutation({
    mutationFn: (v: Parameters<typeof placesApi.putLocation>[1]) =>
      placesApi.putLocation(id, v),
    onSuccess: () => {
      notify("Pin saved");
      invalidateAll();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Save failed", "error"),
  });

  const clearPinMut = useMutation({
    mutationFn: () => placesApi.deleteLocation(id),
    onSuccess: () => {
      notify("Cleared own pin");
      invalidateAll();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Clear pin failed", "error"),
  });

  if (listQ.isLoading || codesQ.isLoading) {
    return (
      <Stack alignItems="center" sx={{ mt: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }
  if (listQ.error) return <ErrorAlert error={listQ.error} />;
  if (!place) return <Alert severity="warning">Not found</Alert>;

  const rows = listQ.data?.items ?? [];
  const parentOptions = [
    { placeId: null as number | null, label: "(top level)" },
    ...rows
      .filter((p) => p.id !== place.id)
      .map((p) => ({
        placeId: p.id as number | null,
        label: p.path.join(" › "),
      })),
  ];
  const parentValue =
    parentOptions.find((o) => o.placeId === parentId) ?? parentOptions[0];
  const pageOptions =
    pagesQ.data?.items?.filter((p) => p.role === "none" && !p.isHidden) ?? [];

  const attachedCodes = place.codes;
  const unattachedCodes =
    codesQ.data?.items?.filter((c) => !c.attachment) ?? [];

  const handleSave = () => {
    const body: Parameters<typeof placesApi.patch>[1] = {
      parentId,
      name: name.trim(),
      description: description.trim(),
    };
    if (opensChoice === "place") {
      body.opensPageId = null;
      body.forwardUrl = null;
    } else if (opensChoice === "page") {
      body.opensPageId = opensPageId === "" ? null : Number(opensPageId);
      body.forwardUrl = null;
    } else {
      body.forwardUrl = forwardUrl.trim() || null;
      body.opensPageId = null;
    }
    patchMut.mutate(body);
  };

  return (
    <>
      <PageHeader
        title={`Place: ${place.name}`}
        actions={
          <Button component={RouterLink} to="/places">
            Back to list
          </Button>
        }
      />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper sx={{ p: 2, flexGrow: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Details
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              inputProps={{ maxLength: 120 }}
              helperText={`${name.length} / 120`}
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              multiline
              minRows={2}
              helperText={`${description.length} / 500`}
            />
            <Autocomplete
              options={parentOptions}
              value={parentValue}
              onChange={(_, v) => setParentId(v ? v.placeId : null)}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.placeId === b.placeId}
              renderInput={(p) => <TextField {...p} label="Parent place" />}
            />
            <Box>
              <Typography variant="subtitle2">Opens</Typography>
              <RadioGroup
                value={opensChoice}
                onChange={(e) => setOpensChoice(e.target.value as OpensChoice)}
              >
                <FormControlLabel
                  value="place"
                  control={<Radio size="small" />}
                  label="Inherit"
                />
                <FormControlLabel
                  value="page"
                  control={<Radio size="small" />}
                  label={
                    <Autocomplete
                      size="small"
                      options={pageOptions}
                      getOptionLabel={(p) => `${p.title} (/${p.slug})`}
                      value={
                        pageOptions.find((p) => Number(p.id) === opensPageId) ??
                        null
                      }
                      onChange={(_, v) => {
                        setOpensPageId(v ? Number(v.id) : "");
                        setOpensChoice("page");
                      }}
                      sx={{ width: { xs: "100%", sm: 260 } }}
                      renderInput={(p) => (
                        <TextField {...p} label="Site page" placeholder="Choose" />
                      )}
                    />
                  }
                />
                <FormControlLabel
                  value="url"
                  control={<Radio size="small" />}
                  label={
                    <TextField
                      size="small"
                      label="Forward URL"
                      value={forwardUrl}
                      onChange={(e) => {
                        setForwardUrl(e.target.value);
                        setOpensChoice("url");
                      }}
                      placeholder="https://…"
                      sx={{ minWidth: { xs: "100%", sm: 320 } }}
                    />
                  }
                />
              </RadioGroup>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={patchMut.isPending}
              >
                Save
              </Button>
              {patchMut.error ? <ErrorAlert error={patchMut.error} /> : null}
            </Stack>
          </Stack>
        </Paper>

        <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 340 }, maxWidth: "100%" }}>
          <LocationCard
            place={place}
            apiKey={config.googleMapsKey}
            onPin={(v) => pinMut.mutate(v)}
            onClearOwnPin={() => clearPinMut.mutate()}
            saving={pinMut.isPending || clearPinMut.isPending}
          />
        </Box>
      </Stack>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Codes attached here
          </Typography>
          {attachedCodes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              None yet.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {attachedCodes.map((c) => (
                <Chip
                  key={String(c.id)}
                  label={c.tag}
                  onDelete={() => detachMut.mutate(c.id)}
                  data-testid={`attached-code-${c.tag}`}
                />
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <Autocomplete
              size="small"
              sx={{ width: { xs: "100%", sm: 260 } }}
              options={unattachedCodes.map((c) => ({ id: c.id, tag: c.tag }))}
              value={
                unattachedCodes.find((c) => c.id === attachCodeId)
                  ? { id: Number(attachCodeId), tag: String(attachCodeId) }
                  : null
              }
              onChange={(_, v) => setAttachCodeId(v ? v.id : "")}
              getOptionLabel={(o) => o.tag}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(p) => (
                <TextField {...p} label="Unattached code" placeholder="qr-…" />
              )}
            />
            <Button
              variant="contained"
              disabled={!attachCodeId || attachMut.isPending}
              onClick={() =>
                attachCodeId && attachMut.mutate(Number(attachCodeId))
              }
            >
              Attach here
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}
