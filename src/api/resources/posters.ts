import { del, get, patch, post } from "../client";
import type { Poster, PosterSummary } from "../types";

// The poster layout document is the panel's own (admin.md 6.3, Poster
// studio); the API stores any object as it is.
export type CreatePosterBody = {
  name: string;
  routeId?: number | null;
  layout?: object | null;
};

export type PatchPosterBody = Partial<{
  name: string;
  routeId: number | null;
  layout: object | null;
}>;

export const posters = {
  list: () => get<{ items: PosterSummary[] }>("/admin/posters"),
  get: (id: number) => get<Poster>(`/admin/posters/${id}`),
  create: (b: CreatePosterBody) => post<Poster>("/admin/posters", b),
  patch: (id: number, b: PatchPosterBody) =>
    patch<Poster>(`/admin/posters/${id}`, b),
  remove: (id: number) => del(`/admin/posters/${id}`),
};
