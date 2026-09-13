import type { Opens } from "../../api/types";

// The printed tag format (contracts 4.5a): `qr-` followed by digits.
// The scan page accepts either the bare tag or the full printed URL
// `https://<site>/q/<tag>`.
export function extractTag(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const url = trimmed.match(/\/q\/([a-z]+-\d+)/i);
  if (url && url[1]) return url[1].toLowerCase();
  const bare = trimmed.match(/^([a-z]+-\d+)$/i);
  if (bare && bare[1]) return bare[1].toLowerCase();
  return null;
}

// admin.md 6.23 opens cell: "(from <place>)", "(own)", or "(default)"
// suffix depending on `opensSource`.
export function formatOpens(
  opens: Opens,
  source: "code" | "place" | "home"
): string {
  const suffix =
    source === "place" ? " (from place)" : source === "code" ? " (own)" : " (default)";
  const target =
    opens.kind === "home"
      ? "Home page"
      : opens.kind === "page"
        ? `Site page /${opens.slug}`
        : opens.url;
  return `${target}${suffix}`;
}

// Group codes by their batchNo for the print sheet's batch select.
export function groupBatches<T extends { batchNo: number; printedAt: string }>(
  rows: T[]
): { batchNo: number; printedAt: string; items: T[] }[] {
  const by = new Map<number, { batchNo: number; printedAt: string; items: T[] }>();
  for (const r of rows) {
    const existing = by.get(r.batchNo);
    if (!existing) {
      by.set(r.batchNo, { batchNo: r.batchNo, printedAt: r.printedAt, items: [r] });
    } else {
      existing.items.push(r);
      if (r.printedAt > existing.printedAt) existing.printedAt = r.printedAt;
    }
  }
  return Array.from(by.values()).sort((a, b) => b.batchNo - a.batchNo);
}
