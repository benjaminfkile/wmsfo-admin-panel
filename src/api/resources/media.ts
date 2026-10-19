import { del, get, patch, post } from "../client";
import type { MediaAsset, MediaUsage, Page, UploadTicket } from "../types";

export type MediaQuery = {
  cursor?: string;
  limit?: number;
  kind?: "raster" | "svg" | "gif" | "video";
  state?: "pending" | "ready" | "orphaned";
  q?: string;
};

export type MediaKind = NonNullable<MediaQuery["kind"]>;

// The kinds every picker but the media block and the media section item
// offers: a video is allowed only in those two places (contracts 1.3b).
export const IMAGE_KINDS: MediaKind[] = ["raster", "svg", "gif"];

// The kinds the media block and the media section item offer.
export const IMAGE_AND_VIDEO_KINDS: MediaKind[] = [...IMAGE_KINDS, "video"];

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
  patch: (
    id: string,
    b: Partial<{
      alt: string;
      title: string;
      credit: string | null;
      darkMediaId: string | null;
      invertInDark: boolean;
      smallMediaId: string | null;
      posterMediaId: string | null;
    }>
  ) =>
    patch<MediaAsset>(`/admin/media/${id}`, b),
  remove: (id: string) => del(`/admin/media/${id}`),
};
