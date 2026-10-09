import type { TrackerTheme } from "../../api/types";

// Sorting and renumbering for the theme groups (admin.md 6.28).

export function bySortOrder(a: TrackerTheme, b: TrackerTheme): number {
  return (
    Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
    Number(a.id ?? 0) - Number(b.id ?? 0)
  );
}

// The `sortOrder` patches for a group reordered to `next`. The group's
// own values are handed out again in ascending order, so only the cards
// whose position changed get a new value; a group with repeated values
// is renumbered in steps of 10 instead.
export function sortOrderPatches(
  next: TrackerTheme[]
): Array<{ id: number; sortOrder: number }> {
  const values = next
    .map((t) => Number(t.sortOrder ?? 0))
    .sort((a, b) => a - b);
  const distinct = new Set(values).size === values.length;
  return next
    .map((t, i) => ({
      id: Number(t.id),
      from: Number(t.sortOrder ?? 0),
      sortOrder: distinct ? values[i]! : (i + 1) * 10,
    }))
    .filter((p) => p.from !== p.sortOrder)
    .map(({ id, sortOrder }) => ({ id, sortOrder }));
}
