// Builds the one-line summary shown in a section card's header
// (admin.md 6.14). Rules by kind:
//   rich_text: block kinds in the order they appear, e.g.
//     "Heading, paragraph, list of 4". A `list` block adds its
//     line count as "list of N".
//   any kind with items (kind.hasItems): "N items".
//   hero: the section title text.
//   other kinds: the section heading when the data has one.
// Returns an empty string when nothing meaningful is set yet.

import type { KindInfo, SectionAdmin } from "../../api/types";

type Block = { kind?: unknown; items?: unknown };

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function capitalizeFirst(s: string): string {
  if (s.length === 0) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function richTextSummary(data: Record<string, unknown>): string {
  const blocks = Array.isArray(data["blocks"]) ? data["blocks"] : [];
  if (blocks.length === 0) return "";
  const parts: string[] = [];
  for (const b of blocks as Block[]) {
    const kind = typeof b?.kind === "string" ? b.kind : "";
    if (!kind) continue;
    if (kind === "list") {
      const n = Array.isArray(b.items) ? b.items.length : 0;
      parts.push(`list of ${n}`);
    } else {
      parts.push(kind);
    }
  }
  if (parts.length === 0) return "";
  const first = capitalizeFirst(parts[0]!);
  const rest = parts.slice(1);
  return [first, ...rest].join(", ");
}

export function sectionSummary(
  section: SectionAdmin,
  kind: KindInfo
): string {
  const data =
    section.data && typeof section.data === "object"
      ? (section.data as Record<string, unknown>)
      : {};

  if (kind.kind === "rich_text") {
    return truncate(richTextSummary(data), 80);
  }

  if (kind.hasItems) {
    const n = (section.items ?? []).length;
    return `${n} ${n === 1 ? "item" : "items"}`;
  }

  if (kind.kind === "hero") {
    if (isString(data["title"])) return truncate(data["title"], 80);
    return "";
  }

  if (isString(data["heading"])) return truncate(data["heading"], 80);
  return "";
}

// Item summary shown in an item card header (admin.md 6.14):
// prefer the item's `label`, else a link's label, else empty.
export function itemSummary(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (isString(d["label"])) return truncate(d["label"], 80);
  const link = d["link"];
  if (link && typeof link === "object") {
    const l = link as Record<string, unknown>;
    if (isString(l["label"])) return truncate(l["label"], 80);
  }
  return "";
}
