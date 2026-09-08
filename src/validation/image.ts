// Client-side pre-checks for media uploads (admin.md 7.4).
// Size caps and magic-byte sniffing keep the browser from asking for
// an upload ticket when the file already fails the API's rules.

export type SniffedType = "png" | "jpeg" | "webp" | "gif" | "svg" | null;

export const RASTER_MAX_BYTES = 20 * 1024 * 1024;
export const SVG_MAX_BYTES = 1 * 1024 * 1024;

export type SizeIssue =
  | { kind: "raster_too_large"; limit: number; size: number }
  | { kind: "svg_too_large"; limit: number; size: number }
  | { kind: "unsupported_type" };

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const GIF_87A = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF_89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[offset + i] !== prefix[i]) return false;
  }
  return true;
}

function sniffBytes(bytes: Uint8Array): SniffedType {
  if (startsWith(bytes, PNG_MAGIC)) return "png";
  if (startsWith(bytes, JPEG_MAGIC)) return "jpeg";
  if (startsWith(bytes, GIF_87A) || startsWith(bytes, GIF_89A)) return "gif";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "webp";
  if (looksLikeSvg(bytes)) return "svg";
  return null;
}

// SVG: bytes decode as UTF-8 text; after an optional BOM, whitespace, an
// XML declaration, comments, and a DOCTYPE, the text begins with "<svg".
function looksLikeSvg(bytes: Uint8Array): boolean {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return false;
  }
  // Strip a BOM.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let i = 0;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    // Skip whitespace.
    if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
      i += 1;
      continue;
    }
    if (c !== 0x3c) return false; // must be `<`
    // Try known non-svg leading tokens.
    if (text.startsWith("<?xml", i)) {
      const end = text.indexOf("?>", i + 5);
      if (end === -1) return false;
      i = end + 2;
      continue;
    }
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end === -1) return false;
      i = end + 3;
      continue;
    }
    if (text.startsWith("<!DOCTYPE", i) || text.startsWith("<!doctype", i)) {
      const end = text.indexOf(">", i + 9);
      if (end === -1) return false;
      i = end + 1;
      continue;
    }
    // At the root element.
    if (text.startsWith("<svg", i)) {
      const next = text.charCodeAt(i + 4);
      // Followed by whitespace or ">" (and not `<svgfoo`).
      if (
        next === 0x20 ||
        next === 0x09 ||
        next === 0x0a ||
        next === 0x0d ||
        next === 0x3e ||
        next === 0x2f
      ) {
        return true;
      }
    }
    return false;
  }
  return false;
}

export async function sniff(file: File): Promise<SniffedType> {
  const slice = file.slice(0, 512);
  const buf = await readAsArrayBuffer(slice);
  return sniffBytes(new Uint8Array(buf));
}

function readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof (blob as { arrayBuffer?: unknown }).arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsArrayBuffer(blob);
  });
}

export function checkSize(size: number, sniffed: SniffedType): SizeIssue | null {
  if (sniffed === null) return { kind: "unsupported_type" };
  if (sniffed === "svg") {
    if (size > SVG_MAX_BYTES) {
      return { kind: "svg_too_large", limit: SVG_MAX_BYTES, size };
    }
    return null;
  }
  if (size > RASTER_MAX_BYTES) {
    return { kind: "raster_too_large", limit: RASTER_MAX_BYTES, size };
  }
  return null;
}

export function contentTypeFor(sniffed: Exclude<SniffedType, null>): string {
  switch (sniffed) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
  }
}

export function sizeIssueMessage(issue: SizeIssue): string {
  switch (issue.kind) {
    case "raster_too_large":
      return "File is larger than 20 MB";
    case "svg_too_large":
      return "SVG is larger than 1 MB";
    case "unsupported_type":
      return "Unsupported image type";
  }
}

// Exported for tests.
export { sniffBytes };
