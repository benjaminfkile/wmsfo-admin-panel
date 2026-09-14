import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import { useConfig } from "../../ConfigContext";
import type { QrCode } from "../../api/types";
import { qrTargetUrl, renderSvg } from "./qrRender";
import { groupBatches } from "./qrHelpers";

export interface PrintSheetSize {
  mm: number;
  perRow: number;
  label: string;
}

// admin.md 6.23 sizes.
export const PRINT_SIZES: PrintSheetSize[] = [
  { mm: 50, perRow: 6, label: "50 mm · six per row" },
  { mm: 100, perRow: 3, label: "100 mm · three per row" },
  { mm: 200, perRow: 1, label: "200 mm · one per row" },
  { mm: 300, perRow: 1, label: "300 mm · one per page" },
];

interface Props {
  open: boolean;
  codes: QrCode[];
  onClose: () => void;
}

export default function PrintSheetDialog({ open, codes, onClose }: Props) {
  const { siteBaseUrl } = useConfig();
  const batches = useMemo(() => groupBatches(codes), [codes]);
  const [batchNo, setBatchNo] = useState<number | "">(
    batches[0]?.batchNo ?? ""
  );
  const [sizeMm, setSizeMm] = useState<number>(PRINT_SIZES[1]?.mm ?? 100);

  useEffect(() => {
    if (open) {
      setBatchNo((prev) =>
        prev === "" && batches[0] ? batches[0].batchNo : prev
      );
    }
  }, [open, batches]);

  const selected = useMemo(() => {
    const batch = batches.find((b) => b.batchNo === batchNo);
    return batch?.items ?? [];
  }, [batches, batchNo]);

  const size =
    PRINT_SIZES.find((s) => s.mm === sizeMm) ?? PRINT_SIZES[1] ?? PRINT_SIZES[0]!;

  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || selected.length === 0) return;
    let cancelled = false;
    setLoading(true);
    const targetPx = Math.round((size.mm / 25.4) * 96);
    const jobs = selected.map(async (row) => {
      const svg = await renderSvg(qrTargetUrl(siteBaseUrl, row.tag), targetPx);
      return [row.tag, svg] as const;
    });
    void Promise.all(jobs).then((pairs) => {
      if (cancelled) return;
      setSvgs(Object.fromEntries(pairs));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selected, size.mm, siteBaseUrl]);

  const columnBasis = `${100 / size.perRow}%`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Print sheet</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label="Batch"
            value={batchNo === "" ? "" : String(batchNo)}
            onChange={(e) => setBatchNo(Number(e.target.value))}
            sx={{ minWidth: { xs: "100%", sm: 220 } }}
          >
            {batches.length === 0 ? (
              <MenuItem value="" disabled>
                No batches yet
              </MenuItem>
            ) : (
              batches.map((b) => (
                <MenuItem key={b.batchNo} value={String(b.batchNo)}>
                  Batch {b.batchNo} · {b.items.length} codes
                </MenuItem>
              ))
            )}
          </TextField>
          <TextField
            select
            size="small"
            label="Size"
            value={String(sizeMm)}
            onChange={(e) => setSizeMm(Number(e.target.value))}
            sx={{ minWidth: { xs: "100%", sm: 240 } }}
          >
            {PRINT_SIZES.map((s) => (
              <MenuItem key={s.mm} value={String(s.mm)}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
            A phone reads a code from about ten times its width.
          </Typography>
        </Stack>

        {loading ? (
          <Stack alignItems="center" sx={{ my: 4 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : null}

        {selected.length === 0 && !loading ? (
          <Alert severity="info">Pick a batch to render.</Alert>
        ) : null}

        {/* The print stylesheet: hides everything but this sheet on
            print, sets @page margins, and avoids splitting a code
            across page breaks. */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .qr-print-sheet, .qr-print-sheet * { visibility: visible !important; }
            .qr-print-sheet { position: fixed; inset: 0; background: #fff; }
          }
          @page { margin: 12mm; }
          .qr-print-cell { break-inside: avoid; page-break-inside: avoid; }
          .qr-print-code { width: ${size.mm}mm; height: ${size.mm}mm; }
          .qr-print-code svg { width: 100% !important; height: 100% !important; display: block; }
          .qr-print-tag { text-align: center; font-family: monospace; font-size: 10pt; margin-top: 4mm; }
        `}</style>

        <Box
          ref={sheetRef}
          className="qr-print-sheet"
          sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}
        >
          {selected.map((row) => (
            <Box
              key={String(row.id)}
              className="qr-print-cell"
              data-testid={`print-cell-${row.id}`}
              sx={{
                flex: `0 0 ${columnBasis}`,
                boxSizing: "border-box",
                p: 1,
                pageBreakInside: "avoid",
                breakInside: "avoid",
              }}
            >
              <Box className="qr-print-code" sx={{ mx: "auto" }}>
                {svgs[row.tag] ? (
                  <span
                    // The qrcode package returns clean SVG text; it is not
                    // user input and never round-trips through untrusted
                    // sources.
                    dangerouslySetInnerHTML={{ __html: svgs[row.tag] ?? "" }}
                  />
                ) : null}
              </Box>
              <Box className="qr-print-tag">{row.tag}</Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          onClick={handlePrint}
          disabled={selected.length === 0 || loading}
        >
          Print
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
