import { del, get, patch, post, put } from "../client";
import type { Sponsor, SponsorOrderRow } from "../types";

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
  order: (eventYear: number) =>
    get<{ items: SponsorOrderRow[] }>(`/admin/sponsors/order/${eventYear}`),
  putOrder: (eventYear: number, pinnedSponsorIds: number[]) =>
    put<{ items: SponsorOrderRow[] }>(
      `/admin/sponsors/order/${eventYear}`,
      { pinnedSponsorIds }
    ),
};
