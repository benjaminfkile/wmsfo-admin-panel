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
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qr as qrApi } from "../../api/resources/qr";
import { places as placesApi } from "../../api/resources/places";
import { pages as pagesApi } from "../../api/resources/pages";
import { keys } from "../../queries/keys";
import { useConfig } from "../../ConfigContext";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import { formatMt, formatMtDate } from "../../lib/time";
import type { Place, QrCodeDetail } from "../../api/types";
import AttachDialog from "./AttachDialog";
import DailyChart from "./DailyChart";
import { qrTargetUrl, renderPngDataUrlMm, renderSvg } from "./qrRender";

type OpensChoice = "place" | "page" | "url";

export default function QrCodeDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const notify = useNotify();
  const config = useConfig();

  const detailQ = useQuery({
    queryKey: keys.qrCode(id),
    queryFn: () => qrApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const placesQ = useQuery({
    queryKey: keys.places,
    queryFn: () => placesApi.list(),
  });

  const pagesQ = useQuery({
    queryKey: keys.pages,
    queryFn: () => pagesApi.list(),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.qrCode(id) });
    void qc.invalidateQueries({ queryKey: keys.qrCodes });
  };

  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [opensChoice, setOpensChoice] = useState<OpensChoice>("place");
  const [opensPageId, setOpensPageId] = useState<number | "">("");
  const [forwardUrl, setForwardUrl] = useState("");
  const [downloadMm, setDownloadMm] = useState(50);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);

  useEffect(() => {
    const d = detailQ.data;
    if (!d) return;
    setNote(d.note ?? "");
    setActive(!!d.active);
    if (d.opensPageId != null) {
      setOpensChoice("page");
      setOpensPageId(d.opensPageId);
      setForwardUrl("");
    } else if (d.forwardUrl) {
      setOpensChoice("url");
      setForwardUrl(d.forwardUrl);
      setOpensPageId("");
    } else {
      setOpensChoice("place");
      setOpensPageId("");
      setForwardUrl("");
    }
  }, [detailQ.data]);

  useEffect(() => {
    if (!detailQ.data) return;
    let cancelled = false;
    const target = qrTargetUrl(config.siteBaseUrl, detailQ.data.tag);
    void renderSvg(target, 320).then((svg) => {
      if (!cancelled) setPreviewSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [detailQ.data, config.siteBaseUrl]);

  const patchMut = useMutation({
    mutationFn: (body: Parameters<typeof qrApi.patch>[1]) => qrApi.patch(id, body),
    onSuccess: () => {
      notify("Saved");
      invalidate();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Save failed", "error"),
  });

  const detachMut = useMutation({
    mutationFn: () => qrApi.detach(id),
    onSuccess: () => {
      notify("Detached");
      invalidate();
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Detach failed", "error"),
  });

  const attachMut = useMutation({
    mutationFn: (placeId: number) => qrApi.attach(id, { placeId }),
    onSuccess: () => {
      notify("Attached");
      invalidate();
      setMovePickerOpen(false);
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Attach failed", "error"),
  });

  const daily = useMemo(() => detailQ.data?.daily ?? [], [detailQ.data]);
  const history = detailQ.data?.history ?? [];
  const scans = detailQ.data?.scans;

  const perDay = useMemo(() => {
    if (daily.length === 0) return 0;
    const total = daily.reduce((a, d) => a + d.people, 0);
    return +(total / daily.length).toFixed(2);
  }, [daily]);

  const placeItems: Place[] = placesQ.data?.items ?? [];
  const pageOptions =
    pagesQ.data?.items?.filter((p) => p.role === "none" && !p.isHidden) ?? [];

  const handleSave = () => {
    const body: Parameters<typeof qrApi.patch>[1] = { note, active };
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

  const downloadSvg = async () => {
    if (!detailQ.data) return;
    const url = qrTargetUrl(config.siteBaseUrl, detailQ.data.tag);
    const pixels = Math.round((downloadMm / 25.4) * 96);
    const svg = await renderSvg(url, pixels);
    triggerDownload(
      new Blob([svg], { type: "image/svg+xml" }),
      `${detailQ.data.tag}-${downloadMm}mm.svg`
    );
  };

  const downloadPng = async () => {
    if (!detailQ.data) return;
    const url = qrTargetUrl(config.siteBaseUrl, detailQ.data.tag);
    const dataUrl = await renderPngDataUrlMm(url, downloadMm);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    triggerDownload(blob, `${detailQ.data.tag}-${downloadMm}mm.png`);
  };

  if (detailQ.isLoading) {
    return (
      <Stack alignItems="center" sx={{ mt: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (detailQ.error) return <ErrorAlert error={detailQ.error} />;
  if (!detailQ.data) return <Alert severity="warning">Not found</Alert>;

  const d: QrCodeDetail = detailQ.data;

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">QR code {d.tag}</Typography>
        <Button component={RouterLink} to="/qr-codes">
          Back to list
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper sx={{ p: 2, textAlign: "center", minWidth: 340 }} data-testid="qr-detail-code">
          <Box
            sx={{ width: 320, height: 320, mx: "auto" }}
            aria-label={`QR for ${d.tag}`}
          >
            {previewSvg ? (
              <span dangerouslySetInnerHTML={{ __html: previewSvg }} />
            ) : (
              <CircularProgress />
            )}
          </Box>
          <Typography variant="h6" sx={{ mt: 1, fontFamily: "monospace" }}>
            {d.tag}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {qrTargetUrl(config.siteBaseUrl, d.tag)}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <TextField
              size="small"
              label="Size (mm)"
              type="number"
              value={downloadMm}
              onChange={(e) => setDownloadMm(Math.max(10, Number(e.target.value) || 50))}
              inputProps={{ min: 10, max: 400 }}
              sx={{ width: 120 }}
            />
            <Button onClick={downloadSvg} variant="outlined">
              SVG
            </Button>
            <Button onClick={downloadPng} variant="outlined">
              PNG
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            PNG rendered at 300 dpi.
          </Typography>
        </Paper>

        <Paper sx={{ p: 2, flexGrow: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Settings
          </Typography>

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2">Attached to</Typography>
              {d.attachment ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={d.attachment.placePath.join(" › ")} />
                  <Button
                    size="small"
                    onClick={() => detachMut.mutate()}
                    disabled={detachMut.isPending}
                  >
                    Detach
                  </Button>
                  <Button size="small" onClick={() => setMovePickerOpen(true)}>
                    Move to another place
                  </Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="Unattached" color="warning" variant="outlined" />
                  <Button size="small" onClick={() => setMovePickerOpen(true)}>
                    Attach…
                  </Button>
                </Stack>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2">Opens</Typography>
              <RadioGroup
                value={opensChoice}
                onChange={(e) => setOpensChoice(e.target.value as OpensChoice)}
              >
                <FormControlLabel
                  value="place"
                  control={<Radio size="small" />}
                  label="Same as the place"
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
                      sx={{ width: 260 }}
                      renderInput={(p) => (
                        <TextField {...p} label="Site page" placeholder="Choose a page" />
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
                      sx={{ minWidth: 320 }}
                    />
                  }
                />
              </RadioGroup>
            </Box>

            <TextField
              label="Note"
              multiline
              minRows={2}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              helperText={`${note.length} / 500`}
            />

            <FormControlLabel
              control={
                <Switch checked={active} onChange={(_, v) => setActive(v)} />
              }
              label="Active"
            />

            <Typography variant="body2" color="text.secondary">
              Printed: Batch {d.batchNo} · {formatMtDate(d.printedAt)}
            </Typography>

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
      </Stack>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Where it has been
          </Typography>
          {history.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No attachments yet.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Place</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell align="right">People</TableCell>
                    <TableCell>Early scans</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.attachmentId}>
                      <TableCell>{row.placePath.length > 0 ? row.placePath.join(" › ") : "a place since deleted"}</TableCell>
                      <TableCell>{formatMt(row.fromAt)}</TableCell>
                      <TableCell>
                        {row.toAt ? formatMt(row.toAt) : "current"}
                      </TableCell>
                      <TableCell align="right">{row.people}</TableCell>
                      <TableCell>
                        {row.earlyScans > 0
                          ? `includes ${row.earlyScans} scans from the hour before it was attached`
                          : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
        <StatCard label="People (all attachments)" value={scans?.people ?? 0} />
        <StatCard label="Flagged hits" value={scans?.flagged ?? 0} />
        <StatCard label="People per day (14 days)" value={perDay} />
      </Stack>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Last 14 days
          </Typography>
          <DailyChart daily={daily} />
        </CardContent>
      </Card>

      {movePickerOpen ? (
        <AttachDialog
          open
          places={placeItems}
          onCancel={() => setMovePickerOpen(false)}
          onSubmit={(placeId) => attachMut.mutate(placeId)}
          submitting={attachMut.isPending}
          error={attachMut.error}
          title={d.attachment ? "Move to another place" : "Attach to a place"}
        />
      ) : null}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Paper sx={{ p: 2, flex: 1, textAlign: "center" }}>
      <Typography variant="h4">{value}</Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
