import { get, put } from "../client";
import type { SiteSettingsDraft } from "../types";

export const siteSettings = {
  get: () => get<SiteSettingsDraft>("/admin/site-settings"),
  put: (data: object) =>
    put<SiteSettingsDraft>("/admin/site-settings", { data }),
};
