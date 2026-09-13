import type { Opens } from "../../api/types";

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
