import { del, get, patch, post, put } from "../client";
import type { Sponsor, SponsorOrderRow, SponsorYear } from "../types";

export type SponsorBody = { name: string } & Partial<
  Record<
    | "contactPerson"
    | "email"
    | "phone"
    | "address"
    | "websiteUrl"
    | "fbUrl"
    | "igUrl"
    | "logoMediaId",
    string | null
  >
>;

export type SponsorYearBody = {
  amountDonated: number | null;
  active: boolean;
  canAdvertise: boolean;
  anonymous: boolean;
  pinnedPosition: number | null;
  lingerMsOverride: number | null;
};

export type SponsorImportResult = { created: number; skipped: number };

export const sponsors = {
  list: () => get<{ items: Sponsor[] }>("/admin/sponsors"),
  get: (id: number) => get<Sponsor>(`/admin/sponsors/${id}`),
  create: (b: SponsorBody) => post<Sponsor>("/admin/sponsors", b),
  patch: (id: number, b: Partial<SponsorBody>) =>
    patch<Sponsor>(`/admin/sponsors/${id}`, b),
  remove: (id: number) => del(`/admin/sponsors/${id}`),
  putYear: (id: number, eventYear: number, b: SponsorYearBody) =>
    put<Sponsor>(`/admin/sponsors/${id}/years/${eventYear}`, b),
  deleteYear: (id: number, eventYear: number) =>
    del(`/admin/sponsors/${id}/years/${eventYear}`),
  copyYearFrom: (id: number, targetYear: number, sourceYear: number) =>
    post<SponsorYear>(
      `/admin/sponsors/${id}/years/${targetYear}/copy-from/${sourceYear}`
    ),
  importFromYear: (fromYear: number, toYear: number, sponsorIds: number[]) =>
    post<SponsorImportResult>("/admin/sponsors/import", {
      fromYear,
      toYear,
      sponsorIds,
    }),
  order: (eventYear: number) =>
    get<{ items: SponsorOrderRow[] }>(`/admin/sponsors/order/${eventYear}`),
  putOrder: (eventYear: number, pinnedSponsorIds: number[]) =>
    put<{ items: SponsorOrderRow[] }>(
      `/admin/sponsors/order/${eventYear}`,
      { pinnedSponsorIds }
    ),
};
