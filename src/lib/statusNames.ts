import type { StatusId } from "../api/types";

// Human-readable labels for the five event statuses (admin.md 6.2).
export const STATUS_NAMES: Record<StatusId, string> = {
  1: "Planned",
  2: "Scheduled",
  3: "Live",
  4: "Ended",
  5: "Cancelled",
};

export const STATUS_IDS: StatusId[] = [1, 2, 3, 4, 5];

export function statusName(id: number | null | undefined): string {
  if (id === null || id === undefined) return "";
  if (id >= 1 && id <= 5) return STATUS_NAMES[id as StatusId];
  return String(id);
}
