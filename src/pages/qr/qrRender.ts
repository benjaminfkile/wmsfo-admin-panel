import QRCode from "qrcode";

// contracts 4.5a: the printed address is https://<site>/q/<tag>.
export function qrTargetUrl(siteBaseUrl: string, tag: string): string {
  const base = siteBaseUrl.replace(/\/+$/, "");
  return `${base}/q/${tag}`;
}

// admin.md 6.23: error correction M, quiet zone four modules.
const COMMON = {
  errorCorrectionLevel: "M" as const,
  margin: 4,
};

// SVG string sized to fit the requested width; used for both the print
// sheet and the SVG download on the detail page.
export function renderSvg(text: string, width: number): Promise<string> {
  return QRCode.toString(text, { ...COMMON, type: "svg", width });
}

// PNG data URL at 300 dpi for the given size in millimetres.
export function renderPngDataUrlMm(text: string, mm: number): Promise<string> {
  const pixels = Math.round((mm / 25.4) * 300);
  return QRCode.toDataURL(text, { ...COMMON, type: "image/png", width: pixels });
}
