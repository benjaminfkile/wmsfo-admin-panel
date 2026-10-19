import { describe, expect, it } from "vitest";
import {
  RASTER_MAX_BYTES,
  SVG_MAX_BYTES,
  VIDEO_MAX_BYTES,
  checkFile,
  checkSize,
  contentTypeFor,
  sizeIssueMessage,
  sniff,
  sniffBytes,
} from "./image";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const GIF87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00]);
const GIF89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46,
  0x00, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20,
]);

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function makeFile(bytes: Uint8Array, filename: string, size?: number): File {
  const padded = size !== undefined ? padTo(bytes, size) : bytes;
  return new File([toBlobPart(padded)], filename);
}

function padTo(bytes: Uint8Array, size: number): Uint8Array {
  if (bytes.length >= size) return bytes;
  const out = new Uint8Array(size);
  out.set(bytes, 0);
  return out;
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

describe("sniffBytes", () => {
  it("recognises PNG by magic bytes", () => {
    expect(sniffBytes(PNG)).toBe("png");
  });
  it("recognises JPEG by magic bytes", () => {
    expect(sniffBytes(JPEG)).toBe("jpeg");
  });
  it("recognises GIF87a and GIF89a", () => {
    expect(sniffBytes(GIF87)).toBe("gif");
    expect(sniffBytes(GIF89)).toBe("gif");
  });
  it("recognises WebP with RIFF + WEBP", () => {
    expect(sniffBytes(WEBP)).toBe("webp");
  });
  it("recognises a plain <svg root", () => {
    expect(sniffBytes(bytesOf("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"))).toBe("svg");
  });
  it("recognises SVG after a BOM", () => {
    expect(sniffBytes(bytesOf("﻿<svg></svg>"))).toBe("svg");
  });
  it("recognises SVG after an XML declaration and comments", () => {
    const s = "<?xml version=\"1.0\"?>\n<!-- a comment -->\n<svg></svg>";
    expect(sniffBytes(bytesOf(s))).toBe("svg");
  });
  it("recognises SVG after a DOCTYPE", () => {
    const s = "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n<svg></svg>";
    expect(sniffBytes(bytesOf(s))).toBe("svg");
  });
  it("rejects HTML that starts with <html", () => {
    expect(sniffBytes(bytesOf("<html></html>"))).toBe(null);
  });
  it("rejects an <svgfoo tag", () => {
    expect(sniffBytes(bytesOf("<svgfoo></svgfoo>"))).toBe(null);
  });
  it("returns null for anything else", () => {
    expect(sniffBytes(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBe(null);
  });
});

describe("sniff (File)", () => {
  it("classifies a renamed PNG as png (declared type ignored)", async () => {
    const file = new File([PNG], "cover.svg", { type: "image/svg+xml" });
    expect(await sniff(file)).toBe("png");
  });
});

describe("checkSize", () => {
  it("returns unsupported_type when sniffed is null", () => {
    expect(checkSize(1000, null)).toEqual({ kind: "unsupported_type" });
  });
  it("accepts a raster at the 20 MB limit", () => {
    expect(checkSize(RASTER_MAX_BYTES, "png")).toBe(null);
  });
  it("refuses a raster one byte over 20 MB", () => {
    const r = checkSize(RASTER_MAX_BYTES + 1, "png");
    expect(r?.kind).toBe("raster_too_large");
  });
  it("accepts an SVG at the 1 MB limit", () => {
    expect(checkSize(SVG_MAX_BYTES, "svg")).toBe(null);
  });
  it("refuses an SVG one byte over 1 MB", () => {
    const r = checkSize(SVG_MAX_BYTES + 1, "svg");
    expect(r?.kind).toBe("svg_too_large");
  });
});

describe("refusing oversized files before any request", () => {
  it("refuses a 21 MB PNG", async () => {
    const twentyOneMb = 21 * 1024 * 1024;
    const file = makeFile(PNG, "big.png", twentyOneMb);
    const kind = await sniff(file);
    expect(kind).toBe("png");
    const issue = checkSize(file.size, kind);
    expect(issue).not.toBe(null);
    expect(issue?.kind).toBe("raster_too_large");
    expect(sizeIssueMessage(issue!)).toBe("File is larger than 20 MB");
  });
  it("refuses a 2 MB SVG", async () => {
    const twoMb = 2 * 1024 * 1024;
    const svgBytes = bytesOf("<svg></svg>");
    const file = makeFile(svgBytes, "big.svg", twoMb);
    const kind = await sniff(file);
    expect(kind).toBe("svg");
    const issue = checkSize(file.size, kind);
    expect(issue).not.toBe(null);
    expect(issue?.kind).toBe("svg_too_large");
    expect(sizeIssueMessage(issue!)).toBe("SVG is larger than 1 MB");
  });
});

describe("contentTypeFor", () => {
  it("maps each type to its MIME", () => {
    expect(contentTypeFor("png")).toBe("image/png");
    expect(contentTypeFor("jpeg")).toBe("image/jpeg");
    expect(contentTypeFor("webp")).toBe("image/webp");
    expect(contentTypeFor("gif")).toBe("image/gif");
    expect(contentTypeFor("svg")).toBe("image/svg+xml");
    expect(contentTypeFor("mp4")).toBe("video/mp4");
  });
});

// An MP4 opens with its `ftyp` box: a 4-byte size, then "ftyp", then the
// major brand.
const MP4 = new Uint8Array([
  0x00, 0x00, 0x00, 0x20,
  0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d,
]);

describe("MP4 pre-check", () => {
  it("sniffs bytes 4 to 8 reading ftyp as mp4", async () => {
    expect(sniffBytes(MP4)).toBe("mp4");
    const kind = await sniff(makeFile(MP4, "flight.mp4"));
    expect(kind).toBe("mp4");
    expect(checkFile("flight.mp4", 300 * 1024 * 1024, kind)).toBeNull();
    expect(contentTypeFor("mp4")).toBe("video/mp4");
  });

  it("accepts a video at exactly 500 MB and refuses one byte more", () => {
    expect(VIDEO_MAX_BYTES).toBe(500 * 1024 * 1024);
    expect(checkSize(VIDEO_MAX_BYTES, "mp4")).toBeNull();
    const issue = checkSize(VIDEO_MAX_BYTES + 1, "mp4");
    expect(issue?.kind).toBe("video_too_large");
    expect(sizeIssueMessage(issue!)).toBe("Video is larger than 500 MB");
  });

  it("does not take ftyp anywhere but bytes 4 to 8", () => {
    const shifted = new Uint8Array([0x00, 0x66, 0x74, 0x79, 0x70, 0x00, 0x00, 0x00]);
    expect(sniffBytes(shifted)).toBeNull();
  });

  it("rejects a png renamed to .mp4", async () => {
    const file = makeFile(PNG, "renamed.mp4");
    const kind = await sniff(file);
    expect(kind).toBe("png");
    const issue = checkFile(file.name, file.size, kind);
    expect(issue?.kind).toBe("not_mp4");
    expect(sizeIssueMessage(issue!)).toBe("Not an MP4 video");
  });

  it("refuses MP4 bytes without the .mp4 name the API requires", () => {
    expect(checkFile("flight.mov", 1000, "mp4")?.kind).toBe("mp4_name");
  });

  it("refuses an MP4 where only images are allowed", () => {
    const issue = checkFile("flight.mp4", 1000, "mp4", false);
    expect(issue?.kind).toBe("video_not_allowed");
    expect(sizeIssueMessage(issue!)).toBe("A video cannot be used here");
  });

  it("leaves pictures to the size check", () => {
    expect(checkFile("hangar.png", 1000, "png")).toBeNull();
    expect(checkFile("big.png", 21 * 1024 * 1024, "png")?.kind).toBe(
      "raster_too_large"
    );
  });
});
