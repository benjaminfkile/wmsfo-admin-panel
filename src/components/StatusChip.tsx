import { Chip } from "@mui/material";
import type { ChipProps } from "@mui/material";
import { statusName } from "../lib/statusNames";

// MUI Chip variant for the five event statuses (admin.md 6.2).
const COLOR: Record<number, ChipProps["color"]> = {
  1: "default",
  2: "info",
  3: "success",
  4: "default",
  5: "warning",
};

export default function StatusChip({
  statusId,
  size = "small",
}: {
  statusId: number | null | undefined;
  size?: "small" | "medium";
}) {
  if (statusId === null || statusId === undefined) {
    return <Chip label="—" size={size} />;
  }
  return (
    <Chip
      label={statusName(statusId)}
      color={COLOR[statusId] ?? "default"}
      size={size}
      variant={statusId === 3 ? "filled" : "outlined"}
    />
  );
}
