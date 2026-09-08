import { del, get, patch, post } from "../client";
import type { MediaAsset, MediaUsage, Page, UploadTicket } from "../types";

export type MediaQuery = {
  cursor?: string;
  limit?: number;
  kind?: "raster" | "svg" | "gif";
  state?: "pending" | "ready" | "orphaned";
  q?: string;
};

export const media = {
  list: (q: MediaQuery) => get<Page<MediaAsset>>("/admin/media", q),
  get: (id: string) => get<MediaAsset>(`/admin/media/${id}`),
  usage: (id: string) => get<MediaUsage>(`/admin/media/${id}/usage`),
  uploadUrl: (b: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    alt: string;
    title: string;
  }) => post<UploadTicket>("/admin/media/upload-url", b),
  confirm: (id: string) => post<MediaAsset>(`/admin/media/${id}/confirm`),
  patch: (id: string, b: Partial<{ alt: string; title: string }>) =>
    patch<MediaAsset>(`/admin/media/${id}`, b),
  remove: (id: string) => del(`/admin/media/${id}`),
};
