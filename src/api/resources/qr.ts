import { del, get, patch, post } from "../client";
import type { QrCode, QrCodeDetail } from "../types";

export type QrGenerateBody = { count: number };
export type QrPatchBody = Partial<{
  opensPageId: number | null;
  forwardUrl: string | null;
  note: string;
  active: boolean;
}>;
export type QrAttachBody = { placeId: number };

export const qr = {
  list: () => get<{ items: QrCode[] }>("/admin/qr-codes"),
  get: (id: number) => get<QrCodeDetail>(`/admin/qr-codes/${id}`),
  generate: (b: QrGenerateBody) =>
    post<{ items: QrCode[] }>("/admin/qr-codes", b),
  patch: (id: number, b: QrPatchBody) =>
    patch<QrCode>(`/admin/qr-codes/${id}`, b),
  attach: (id: number, b: QrAttachBody) =>
    post<QrCode>(`/admin/qr-codes/${id}/attach`, b),
  detach: (id: number) => post<QrCode>(`/admin/qr-codes/${id}/detach`),
  remove: (id: number) => del(`/admin/qr-codes/${id}`),
};
