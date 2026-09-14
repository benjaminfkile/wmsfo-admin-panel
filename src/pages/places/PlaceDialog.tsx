import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import ErrorAlert from "../../components/ErrorAlert";
import type { PageAdmin, Place } from "../../api/types";

// admin.md 6.24 New place dialog: parent picker, name, description,
// opens (same as the place / a site page / a forward URL).
export type PlaceDialogValues = {
  parentId: number | null;
  name: string;
  description: string;
  opensPageId: number | null;
  forwardUrl: string | null;
};

interface Props {
  open: boolean;
  title: string;
  submitLabel: string;
  places: Place[];
  pages: PageAdmin[];
  initial?: Partial<PlaceDialogValues>;
  onCancel: () => void;
  onSubmit: (v: PlaceDialogValues) => void;
  submitting?: boolean;
  error?: unknown;
  // Optional filter: hide these ids from the parent picker (used when
  // moving a place: cannot become its own descendant, contracts 4.5a).
  excludeIds?: Set<number>;
}

type OpensChoice = "place" | "page" | "url";

export default function PlaceDialog({
  open,
  title,
  submitLabel,
  places,
  pages,
  initial,
  onCancel,
  onSubmit,
  submitting = false,
  error,
  excludeIds,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState<number | null>(
    initial?.parentId ?? null,
  );
  const [opensChoice, setOpensChoice] = useState<OpensChoice>(() => {
    if (initial?.opensPageId != null) return "page";
    if (initial?.forwardUrl) return "url";
    return "place";
  });
  const [opensPageId, setOpensPageId] = useState<number | "">(
    initial?.opensPageId ?? "",
  );
  const [forwardUrl, setForwardUrl] = useState(initial?.forwardUrl ?? "");
  const [nameErr, setNameErr] = useState<string | null>(null);

  useEffect(() => {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setParentId(initial?.parentId ?? null);
    if (initial?.opensPageId != null) {
      setOpensChoice("page");
      setOpensPageId(initial.opensPageId);
      setForwardUrl("");
    } else if (initial?.forwardUrl) {
      setOpensChoice("url");
      setForwardUrl(initial.forwardUrl);
      setOpensPageId("");
    } else {
      setOpensChoice("place");
      setOpensPageId("");
      setForwardUrl("");
    }
    setNameErr(null);
  }, [initial]);

  const parentOptions = useMemo(() => {
    const filtered = excludeIds
      ? places.filter((p) => !excludeIds.has(p.id))
      : places;
    return [
      { placeId: null as number | null, label: "(top level)" },
      ...filtered.map((p) => ({
        placeId: p.id as number | null,
        label: p.path.join(" › "),
      })),
    ];
  }, [places, excludeIds]);

  const parentValue =
    parentOptions.find((o) => o.placeId === parentId) ?? parentOptions[0];

  const pageOptions = pages.filter((p) => p.role === "none" && !p.isHidden);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      setNameErr("Name is 1 to 120 characters");
      return;
    }
    setNameErr(null);
    const values: PlaceDialogValues = {
      parentId,
      name: trimmed,
      description: description.trim(),
      opensPageId:
        opensChoice === "page" && opensPageId !== "" ? Number(opensPageId) : null,
      forwardUrl:
        opensChoice === "url" && forwardUrl.trim() ? forwardUrl.trim() : null,
    };
    onSubmit(values);
  };

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {error ? <ErrorAlert error={error} /> : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            options={parentOptions}
            value={parentValue}
            onChange={(_, v) => setParentId(v ? v.placeId : null)}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.placeId === b.placeId}
            renderInput={(p) => <TextField {...p} label="Parent place" />}
          />
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            error={!!nameErr}
            helperText={nameErr ?? `${name.length} / 120`}
            inputProps={{ maxLength: 120 }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            multiline
            minRows={2}
            helperText={`${description.length} / 500`}
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
                label="Inherit from the ancestor (or the home page)"
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
