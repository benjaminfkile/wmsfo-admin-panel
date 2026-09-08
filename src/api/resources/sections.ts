import { del, patch, post, put } from "../client";
import type {
  PageDetail,
  Presentation,
  SectionAdmin,
  SectionItemAdmin,
} from "../types";

export type SectionBody = {
  kind: string;
  position?: number;
  data?: object;
  presentation?: Presentation;
};

export const sections = {
  create: (pageId: number, b: SectionBody) =>
    post<SectionAdmin>(`/admin/pages/${pageId}/sections`, b),
  patch: (
    id: number,
    b: Partial<{ data: object; presentation: Presentation; isHidden: boolean }>
  ) => patch<SectionAdmin>(`/admin/sections/${id}`, b),
  remove: (id: number) => del(`/admin/sections/${id}`),
  duplicate: (id: number) =>
    post<SectionAdmin>(`/admin/sections/${id}/duplicate`),
  move: (id: number, b: { pageId: number; position: number }) =>
    post<SectionAdmin>(`/admin/sections/${id}/move`, b),
  order: (pageId: number, ids: number[]) =>
    put<PageDetail>(`/admin/pages/${pageId}/sections/order`, { ids }),
  createItem: (sectionId: number, b: { data: object; position?: number }) =>
    post<SectionItemAdmin>(`/admin/sections/${sectionId}/items`, b),
  patchItem: (id: number, b: Partial<{ data: object; isHidden: boolean }>) =>
    patch<SectionItemAdmin>(`/admin/items/${id}`, b),
  removeItem: (id: number) => del(`/admin/items/${id}`),
  orderItems: (sectionId: number, ids: number[]) =>
    put<SectionAdmin>(`/admin/sections/${sectionId}/items/order`, { ids }),
};
