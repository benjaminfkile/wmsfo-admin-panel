import { get, patch, post, request } from "../client";
import type { Beacon, BeaconLog, Enrollment } from "../types";

export type BeaconsResponse = { items: Beacon[]; staleAfterS: number };
export type KeyMint = {
  beacon: Beacon;
  key: string;
  enrollment: Enrollment;
};

export const beacons = {
  list: () => get<BeaconsResponse>("/admin/beacons"),
  get: (id: number) => get<Beacon>(`/admin/beacons/${id}`),
  create: (b: { name: string; notes: string; role: "beacon" | "admin" }) =>
    post<KeyMint>("/admin/beacons", b),
  patch: (id: number, b: Partial<{ name: string; notes: string }>) =>
    patch<Beacon>(`/admin/beacons/${id}`, b),
  activate: (id: number) => post<Beacon>(`/admin/beacons/${id}/activate`),
  deactivate: (id: number) => post<Beacon>(`/admin/beacons/${id}/deactivate`),
  rotate: (id: number) => post<KeyMint>(`/admin/beacons/${id}/rotate`),
  revoke: (id: number) => post<Beacon>(`/admin/beacons/${id}/revoke`),
  logs: (id: number) =>
    get<{ items: BeaconLog[] }>(`/admin/beacons/${id}/logs`),
  logText: (id: number, logId: number) =>
    request<string>({
      method: "GET",
      path: `/admin/beacons/${id}/logs/${logId}`,
      parse: "text",
    }),
};
