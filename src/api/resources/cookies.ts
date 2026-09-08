import { del, post } from "../client";
import type { CookieAdmin } from "../types";

export const cookies = {
  hide: (id: number) => post<CookieAdmin>(`/admin/cookies/${id}/hide`),
  unhide: (id: number) => post<CookieAdmin>(`/admin/cookies/${id}/unhide`),
  remove: (id: number) => del(`/admin/cookies/${id}`),
};
