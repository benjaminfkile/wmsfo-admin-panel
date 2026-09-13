import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ErrorAlert from "../../components/ErrorAlert";
import type { Place } from "../../api/types";
import { loadPlaces } from "../places/googleMaps";
import { GEO_MAX_ACCURACY_M } from "../places/LocationCard";

// admin.md 6.25 AttachSheet (phone-width, at the bottom):
// - Step 1 place picker: type to filter over the flattened paths, plus
//   "New place" inline (name; parent defaults to the place chosen).
// - Step 2 pin: the phone's fix with accuracy ("Pin <place> here?", own
//   pin or the parent's), a Places search, or "skip". Attach then pin,
//   two calls.
//
// The sheet stays open through both steps so the canvasser's flow is
// one continuous thumb reach.

export type AttachChoice =
  | { kind: "existing"; placeId: number }
  | { kind: "new"; name: string; parentId: number | null };

export type PinChoice =
  | { kind: "phone"; lat: number; lng: number; accuracyM: number }
  | { kind: "search"; lat: number; lng: number }
  | { kind: "skip" };

interface Props {
  open: boolean;
  tag: string;
  places: Place[];
  apiKey: string;
  // Set when the code is currently attached; the sheet renders the Move
  // headline and keeps the current place preselected.
  currentPlaceId?: number | null;
  onCancel: () => void;
  // Called with the picked or newly-created place id. The parent runs
  // the attach mutation and hands the resolved id back through
  // `pinPlaceId` so the pin step knows where to write.
  onAttach: (choice: AttachChoice) => void;
  attaching?: boolean;
  attachError?: unknown;
  // Once the attach succeeds the parent flips into the pin step.
  step: "attach" | "pin" | "done";
  pinPlaceId?: number | null;
  pinPlaceName?: string;
  onPin: (choice: PinChoice) => void;
  pinning?: boolean;
  pinError?: unknown;
  onDone: () => void;
}

type PlaceOption = { placeId: number; label: string };

export default function AttachSheet({
  open,
  tag,
  places,
  apiKey,
  currentPlaceId = null,
  onCancel,
  onAttach,
  attaching = false,
  attachError,
  step,
  pinPlaceId = null,
  pinPlaceName,
  onPin,
  pinning = false,
  pinError,
  onDone,
}: Props) {
  const options = useMemo<PlaceOption[]>(
    () =>
      places.map((p) => ({ placeId: p.id, label: p.path.join(" › ") })),
    [places],
  );

  const [selected, setSelected] = useState<PlaceOption | null>(null);
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");

  useEffect(() => {
    if (!open) return;
    if (currentPlaceId != null) {
      const cur = options.find((o) => o.placeId === currentPlaceId) ?? null;
      setSelected(cur);
    } else {
      setSelected(null);
    }
    setNewName("");
    setMode("existing");
  }, [open, currentPlaceId, options]);

  const handleAttach = () => {
    if (mode === "new") {
      const trimmed = newName.trim();
      if (!trimmed) return;
      onAttach({
        kind: "new",
        name: trimmed,
        parentId: selected ? selected.placeId : null,
      });
      return;
    }
    if (!selected) return;
    onAttach({ kind: "existing", placeId: selected.placeId });
  };

  // Places Autocomplete for the "search" pin source. Loaded once when
  // the sheet enters the pin step so it is ready as soon as the
  // canvasser sees it.
  const searchInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (step !== "pin") return;
    let cancelled = false;
    (async () => {
      try {
        const placesLib = await loadPlaces(apiKey);
        if (cancelled || !searchInput.current) return;
        const ac = new placesLib.Autocomplete(searchInput.current, {
          fields: ["geometry"],
        });
        ac.addListener("place_changed", () => {
          const p = ac.getPlace();
          const geo = p.geometry?.location;
          if (!geo) return;
          onPin({ kind: "search", lat: geo.lat(), lng: geo.lng() });
        });
      } catch {
        // If Places fails to load the canvasser can still use the
        // phone's fix or skip; no need to surface a modal error here.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, apiKey, onPin]);

  const [phoneStatus, setPhoneStatus] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [fix, setFix] = useState<{ lat: number; lng: number; acc: number } | null>(
    null,
  );

  useEffect(() => {
    if (step !== "pin") {
      setPhoneStatus(null);
      setPhoneError(null);
      setFix(null);
    }
  }, [step]);

  const requestFix = () => {
    setPhoneError(null);
    setFix(null);
    setPhoneStatus("Locating…");
    if (!("geolocation" in navigator)) {
      setPhoneStatus(null);
      setPhoneError("Geolocation is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        if (acc == null || acc > GEO_MAX_ACCURACY_M) {
          setPhoneStatus(null);
          setPhoneError(
            `Accuracy is ${Math.round(acc ?? 0)} m, worse than 500 m. Search or skip.`,
          );
          return;
        }
        setPhoneStatus(`Fix accepted (accuracy ${Math.round(acc)} m).`);
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc,
        });
      },
      (err) => {
        setPhoneStatus(null);
        setPhoneError(`Location failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onCancel}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          p: 2,
          maxHeight: "90vh",
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="h6">
          {step === "attach"
            ? currentPlaceId != null
              ? `Move ${tag}`
              : `Attach ${tag}`
            : step === "pin"
              ? `Pin ${pinPlaceName ?? "place"}`
              : `Attached ${tag}`}
        </Typography>
        <IconButton onClick={onCancel} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {step === "attach" ? (
        <Stack spacing={2}>
          {attachError ? <ErrorAlert error={attachError} /> : null}
          <Autocomplete
            options={options}
            value={selected}
            onChange={(_, v) => {
              setSelected(v);
              if (v) setMode("existing");
            }}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.placeId === b.placeId}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Place"
                placeholder="Type to filter"
                autoFocus
              />
            )}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Or create a new place
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="New place name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (e.target.value) setMode("new");
                }}
                inputProps={{ maxLength: 120 }}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5 }}
            >
              Parent: {selected ? selected.label : "(top level)"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onCancel}>Cancel</Button>
            <Button
              variant="contained"
              size="large"
              disabled={
                attaching ||
                (mode === "existing" ? !selected : !newName.trim())
              }
              onClick={handleAttach}
            >
              {currentPlaceId != null ? "Move" : "Attach"}
            </Button>
          </Stack>
        </Stack>
      ) : step === "pin" ? (
        <Stack spacing={2}>
          {pinError ? <ErrorAlert error={pinError} /> : null}
          <Alert severity="success" variant="outlined">
            Attached to <strong>{pinPlaceName}</strong>.
          </Alert>
          <Typography variant="body2">
            Pin {pinPlaceName ?? "this place"} here?
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              onClick={requestFix}
              disabled={pinning || !pinPlaceId}
            >
              Use my location
            </Button>
            {fix ? (
              <Button
                variant="contained"
                onClick={() =>
                  onPin({
                    kind: "phone",
                    lat: fix.lat,
                    lng: fix.lng,
                    accuracyM: fix.acc,
                  })
                }
                disabled={pinning || !pinPlaceId}
              >
                Pin here (accuracy {Math.round(fix.acc)} m)
              </Button>
            ) : null}
          </Stack>
          {phoneStatus ? (
            <Typography variant="caption" color="text.secondary">
              {phoneStatus}
            </Typography>
          ) : null}
          {phoneError ? (
            <Alert severity="warning">{phoneError}</Alert>
          ) : null}

          <TextField
            inputRef={searchInput}
            fullWidth
            size="small"
            placeholder="Search for a place (Google)"
            inputProps={{ "aria-label": "Places search" }}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              onClick={() => onPin({ kind: "skip" })}
              disabled={pinning}
            >
              Skip
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Alert severity="success" variant="outlined">
            {tag} attached to <strong>{pinPlaceName}</strong>.
          </Alert>
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={onDone}>
              Done
            </Button>
          </Stack>
        </Stack>
      )}
    </Drawer>
  );
}
