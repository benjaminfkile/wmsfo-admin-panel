import { get, post } from "../client";
import type { SnapshotInfo } from "../types";

export const snapshot = {
  get: () => get<SnapshotInfo>("/admin/snapshot"),
  rebuild: () => post<SnapshotInfo>("/admin/snapshot/rebuild"),
};
