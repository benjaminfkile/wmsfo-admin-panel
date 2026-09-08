import { get, patch, post } from "../client";
import type { CookieType, Icon } from "../types";

export type CookieTypeBody = {
  name: string;
  sort: number;
  active: boolean;
  icon: Icon | null;
};

export const cookieTypes = {
  list: () => get<{ items: CookieType[] }>("/admin/cookie-types"),
  create: (b: CookieTypeBody) => post<CookieType>("/admin/cookie-types", b),
  patch: (id: number, b: Partial<CookieTypeBody>) =>
    patch<CookieType>(`/admin/cookie-types/${id}`, b),
};
