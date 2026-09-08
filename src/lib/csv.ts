// Minimal RFC 4180 CSV writer. Used to assemble the subscriber export
// client-side (admin.md 11).

type Value = string | number | boolean | null | undefined;

const CRLF = "\r\n";

function quote(cell: Value): string {
  if (cell === null || cell === undefined) return "";
  const s = String(cell);
  const needs = s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r");
  if (!needs) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(cells: readonly Value[]): string {
  return cells.map(quote).join(",");
}

export function csvJoin(rows: readonly (readonly Value[])[]): string {
  if (rows.length === 0) return "";
  return rows.map(csvRow).join(CRLF) + CRLF;
}

export function csvFromRecords<T extends Record<string, Value>>(
  header: readonly (keyof T)[],
  records: readonly T[]
): string {
  const rows: Value[][] = [header.map(String) as Value[]];
  for (const rec of records) {
    rows.push(header.map((h) => rec[h]));
  }
  return csvJoin(rows);
}
