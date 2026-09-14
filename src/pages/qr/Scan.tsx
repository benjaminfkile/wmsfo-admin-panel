import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qr as qrApi } from "../../api/resources/qr";
import { places as placesApi } from "../../api/resources/places";
import { keys } from "../../queries/keys";
import { useConfig } from "../../ConfigContext";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import type { QrCode } from "../../api/types";
import { extractTag } from "./qrHelpers";
import AttachSheet, { type AttachChoice, type PinChoice } from "./AttachSheet";
import {
  defaultReaderFactory,
  type CodeReaderFactory,
} from "./barcodeReader";

// admin.md 6.25: the camera view, the manual tag field, AttachSheet at
// the bottom for unattached codes, and the attached-code view (Move or
// Done). This is the canvasser's landing page; the whole layout is
// tuned for a phone-width viewport with every control in thumb reach.

interface Props {
  // Tests inject a fake reader that resolves immediately; production
  // takes the default (BarcodeDetector where present, else zxing).
  readerFactory?: CodeReaderFactory;
}

type SheetState =
  | { kind: "closed" }
  | {
      kind: "open";
      tag: string;
      code: QrCode | null;
      step: "attach" | "pin" | "done";
      pinPlaceId: number | null;
      pinPlaceName: string;
      isMove: boolean;
    };

export default function Scan({ readerFactory }: Props = {}) {
  const qc = useQueryClient();
  const notify = useNotify();
  const config = useConfig();

  const factory = readerFactory ?? defaultReaderFactory;

  const codesQ = useQuery({
    queryKey: keys.qrCodes,
    queryFn: () => qrApi.list(),
  });
  const placesQ = useQuery({
    queryKey: keys.places,
    queryFn: () => placesApi.list(),
  });

  const codes = useMemo(() => codesQ.data?.items ?? [], [codesQ.data]);
  const places = useMemo(() => placesQ.data?.items ?? [], [placesQ.data]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: keys.qrCodes });
    void qc.invalidateQueries({ queryKey: keys.places });
  }, [qc]);

  const [manualTag, setManualTag] = useState("");
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>({ kind: "closed" });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<ReturnType<CodeReaderFactory> | null>(null);

  const handleScan = useCallback(
    (raw: string) => {
      const tag = extractTag(raw);
      if (!tag) {
        setReaderError(`Not a WMSFO tag: ${raw}`);
        return;
      }
      setReaderError(null);
      setLastRead(tag);
    },
    [],
  );

  useEffect(() => {
    let stopped = false;
    const reader = factory();
    readerRef.current = reader;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        await reader.start(video, (text) => {
          if (stopped) return;
          handleScan(text);
        });
      } catch (e) {
        setReaderError(
          e instanceof Error
            ? e.message
            : "The camera could not be started; type the tag below.",
        );
      }
    })();

    return () => {
      stopped = true;
      reader.stop();
      readerRef.current = null;
    };
  }, [factory, handleScan]);

  const codeByTag = useMemo(() => {
    const m = new Map<string, QrCode>();
    for (const c of codes) m.set(c.tag, c);
    return m;
  }, [codes]);

  // A tag from the camera or the manual field lands here; look up the
  // code and open the attached-view or the AttachSheet accordingly.
  const openForTag = useCallback(
    (tag: string) => {
      const code = codeByTag.get(tag) ?? null;
      if (!code) {
        notify(`Unknown tag ${tag}`, "warning");
        return;
      }
      if (code.attachment) {
        setSheet({
          kind: "open",
          tag,
          code,
          step: "done",
          pinPlaceId: code.attachment.placeId,
          pinPlaceName: code.attachment.placePath.join(" › "),
          isMove: false,
        });
      } else {
        setSheet({
          kind: "open",
          tag,
          code,
          step: "attach",
          pinPlaceId: null,
          pinPlaceName: "",
          isMove: false,
        });
      }
    },
    [codeByTag, notify],
  );

  useEffect(() => {
    if (!lastRead) return;
    if (sheet.kind === "open") return;
    openForTag(lastRead);
    setLastRead(null);
  }, [lastRead, sheet.kind, openForTag]);

  const createPlaceMut = useMutation({
    mutationFn: (b: {
      name: string;
      parentId: number | null;
    }) =>
      placesApi.create({
        parentId: b.parentId,
        name: b.name,
        description: "",
        opensPageId: null,
        forwardUrl: null,
      }),
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Create place failed", "error"),
  });

  const attachMut = useMutation({
    mutationFn: ({ id, placeId }: { id: number; placeId: number }) =>
      qrApi.attach(id, { placeId }),
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Attach failed", "error"),
  });

  const pinMut = useMutation({
    mutationFn: ({
      placeId,
      body,
    }: {
      placeId: number;
      body: Parameters<typeof placesApi.putLocation>[1];
    }) => placesApi.putLocation(placeId, body),
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Pin failed", "error"),
  });

  const handleAttach = async (choice: AttachChoice) => {
    if (sheet.kind !== "open" || !sheet.code) return;
    try {
      let placeId: number;
      let placeName: string;
      if (choice.kind === "new") {
        const created = await createPlaceMut.mutateAsync({
          name: choice.name,
          parentId: choice.parentId,
        });
        placeId = created.id;
        placeName = created.path.join(" › ");
      } else {
        const existing = places.find((p) => p.id === choice.placeId);
        placeId = choice.placeId;
        placeName = existing ? existing.path.join(" › ") : "the place";
      }
      await attachMut.mutateAsync({ id: sheet.code.id, placeId });
      notify(`${sheet.tag} attached`);
      invalidate();
      setSheet({
        kind: "open",
        tag: sheet.tag,
        code: sheet.code,
        step: "pin",
        pinPlaceId: placeId,
        pinPlaceName: placeName,
        isMove: sheet.isMove,
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Attach failed", "error");
    }
  };

  const handlePin = async (choice: PinChoice) => {
    if (sheet.kind !== "open" || sheet.pinPlaceId == null) return;
    if (choice.kind === "skip") {
      setSheet({ ...sheet, step: "done" });
      return;
    }
    try {
      const body =
        choice.kind === "phone"
          ? {
              lat: choice.lat,
              lng: choice.lng,
              accuracyM: choice.accuracyM,
              source: "phone" as const,
            }
          : {
              lat: choice.lat,
              lng: choice.lng,
              accuracyM: null,
              source: "search" as const,
            };
      await pinMut.mutateAsync({ placeId: sheet.pinPlaceId, body });
      notify("Pinned");
      invalidate();
      setSheet({ ...sheet, step: "done" });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Pin failed", "error");
    }
  };

  const closeSheet = () => setSheet({ kind: "closed" });
  const startMove = () => {
    if (sheet.kind !== "open" || !sheet.code) return;
    setSheet({
      kind: "open",
      tag: sheet.tag,
      code: sheet.code,
      step: "attach",
      pinPlaceId: null,
      pinPlaceName: "",
      isMove: true,
    });
  };

  const handleManual = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = extractTag(manualTag);
    if (!tag) {
      notify("Enter a tag like qr-001", "warning");
      return;
    }
    setManualTag("");
    openForTag(tag);
  };

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", pb: 12 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Scan
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Point the camera at a printed code, or type the tag below.
      </Typography>

      <Card sx={{ mb: 2 }}>
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "3 / 4",
            bgcolor: "black",
          }}
        >
          <Box
            component="video"
            ref={videoRef}
            data-testid="scan-video"
            playsInline
            muted
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: "20%",
              border: "2px solid rgba(255,255,255,0.7)",
              borderRadius: 1,
              pointerEvents: "none",
            }}
          />
        </Box>
        <CardContent>
          {readerError ? (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {readerError}
            </Alert>
          ) : null}
          <form onSubmit={handleManual}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                label="Tag"
                placeholder="qr-001"
                value={manualTag}
                onChange={(e) => setManualTag(e.target.value)}
                inputProps={{ "aria-label": "Manual tag" }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={!manualTag.trim()}
              >
                Open
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>

      {codesQ.error ? <ErrorAlert error={codesQ.error} /> : null}
      {placesQ.error ? <ErrorAlert error={placesQ.error} /> : null}

      {(codesQ.isLoading || placesQ.isLoading) && codes.length === 0 ? (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <CircularProgress size={20} />
        </Stack>
      ) : null}

      <Card>
        <CardContent>
          <Typography variant="subtitle2">Site</Typography>
          <Typography variant="caption" color="text.secondary">
            Codes point at {config.siteBaseUrl.replace(/\/+$/, "")}/q/&lt;tag&gt;.
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {codes.length} code{codes.length === 1 ? "" : "s"} known.
          </Typography>
        </CardContent>
      </Card>

      {sheet.kind === "open" && sheet.step === "done" ? (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle1">
                {sheet.tag} → {sheet.pinPlaceName || "unattached"}
              </Typography>
              {sheet.pinPlaceId != null ? (
                <Chip
                  label={sheet.pinPlaceName}
                  size="small"
                  sx={{ alignSelf: "flex-start" }}
                />
              ) : (
                <Chip label="Unattached" size="small" color="warning" />
              )}
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={startMove}>
                  Move
                </Button>
                <Button variant="contained" onClick={closeSheet}>
                  Done
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {sheet.kind === "open" ? (
        <AttachSheet
          open={sheet.step !== "done" || sheet.isMove}
          tag={sheet.tag}
          places={places}
          apiKey={config.googleMapsKey}
          currentPlaceId={
            sheet.isMove && sheet.code?.attachment
              ? sheet.code.attachment.placeId
              : null
          }
          onCancel={closeSheet}
          onAttach={handleAttach}
          attaching={createPlaceMut.isPending || attachMut.isPending}
          attachError={createPlaceMut.error ?? attachMut.error}
          step={sheet.step}
          pinPlaceId={sheet.pinPlaceId}
          pinPlaceName={sheet.pinPlaceName}
          onPin={handlePin}
          pinning={pinMut.isPending}
          pinError={pinMut.error}
          onDone={closeSheet}
        />
      ) : null}
    </Box>
  );
}
