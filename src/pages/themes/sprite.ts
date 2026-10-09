import { themes as themesApi } from "../../api/resources/themes";
import { uploadToS3 } from "../../api/resources/upload";
import type { UploadTicket } from "../../api/types";
import { readBytes, readText } from "./readFile";

// A MapLibre theme's sprite set (admin.md 6.28, contracts 4.5 Themes):
// the four files taken together, the SHA-256 of the canonical bytes of
// `sprite.json` naming the prefix, the four presigned PUTs, and the
// confirm.

export const SPRITE_FILES = ["sprite.json", "sprite.png", "sprite@2x.json", "sprite@2x.png"] as const;

export const SPRITE_RULE =
  "Choose the four files sprite.json, sprite.png, sprite@2x.json, and sprite@2x.png together.";

export type SpriteSet = Record<(typeof SPRITE_FILES)[number], File>;

// The four sprite files by name, or the reason the selection is refused.
// Each JSON file is sent as its canonical bytes (parsed and written
// compactly), the bytes the index hash is taken over.
export async function readSpriteSet(files: readonly File[]): Promise<SpriteSet | string> {
  const byName = new Map(files.map((f) => [f.name, f]));
  if (files.length !== SPRITE_FILES.length || SPRITE_FILES.some((n) => !byName.has(n))) {
    return SPRITE_RULE;
  }
  const out = {} as SpriteSet;
  for (const name of SPRITE_FILES) {
    const file = byName.get(name)!;
    if (name.endsWith(".json")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readText(file));
      } catch {
        return `${name} is not valid JSON.`;
      }
      out[name] = new File([JSON.stringify(parsed)], name, {
        type: "application/json; charset=utf-8",
      });
    } else {
      out[name] = file;
    }
  }
  return out;
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const bytes = Uint8Array.from(await readBytes(blob));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Sends the set for the theme: the tickets, one PUT per file with the
// ticket's headers, then the confirm.
export async function uploadSprite(themeId: number, set: SpriteSet): Promise<void> {
  const indexSha256 = await sha256Hex(set["sprite.json"]);
  const tickets = await themesApi.spriteTickets(themeId, indexSha256);
  for (const upload of tickets.uploads ?? []) {
    const file = set[upload.file as keyof SpriteSet];
    if (!file) throw new Error(`The sprite ticket names an unknown file ${String(upload.file)}.`);
    const ticket: UploadTicket = { uploadUrl: upload.uploadUrl, headers: upload.headers };
    await uploadToS3(ticket, file, () => undefined);
  }
  await themesApi.confirmSprite(themeId, indexSha256);
}
