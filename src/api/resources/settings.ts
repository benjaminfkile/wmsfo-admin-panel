import { get, put } from "../client";
import type { Setting } from "../types";

export const settings = {
  list: () => get<{ items: Setting[] }>("/admin/settings"),
  put: (key: string, value: number | boolean) =>
    put<Setting>(`/admin/settings/${key}`, { value }),
};
