import { del, get, patch, post, put } from "../client";
import type { PageAdmin, PageDetail } from "../types";

export type PageBody = {
  slug: string;
  title: string;
  navLabel: string | null;
  navPosition?: number;
  isHidden?: boolean;
};

export const pages = {
  list: () => get<{ items: PageAdmin[] }>("/admin/pages"),
  get: (id: number) => get<PageDetail>(`/admin/pages/${id}`),
  create: (b: PageBody) => post<PageAdmin>("/admin/pages", b),
  patch: (id: number, b: Partial<PageBody>) =>
    patch<PageAdmin>(`/admin/pages/${id}`, b),
  remove: (id: number) => del(`/admin/pages/${id}`),
  order: (ids: number[]) =>
    put<{ items: PageAdmin[] }>("/admin/pages/order", { ids }),
};
