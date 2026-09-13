import { del, get, patch, post, put, request } from "../client";
import type { Place, PlacePin } from "../types";

export type PlaceCreateBody = {
  parentId: number | null;
  name: string;
  description: string;
  opensPageId: number | null;
  forwardUrl: string | null;
};
export type PlacePatchBody = Partial<{
  parentId: number | null;
  name: string;
  description: string;
  opensPageId: number | null;
  forwardUrl: string | null;
}>;
export type PlaceLocationBody = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  source: "phone" | "search" | "drag";
};

export type PlaceMapQuery = {
  eventId?: number;
  from?: string;
  to?: string;
};

export type PlaceMapResponse = {
  items: PlacePin[];
  unpinned: number;
  unattached: number;
};

export const places = {
  list: () => get<{ items: Place[] }>("/admin/places"),
  create: (b: PlaceCreateBody) => post<Place>("/admin/places", b),
  patch: (id: number, b: PlacePatchBody) =>
    patch<Place>(`/admin/places/${id}`, b),
  remove: (id: number) => del(`/admin/places/${id}`),
  putLocation: (id: number, b: PlaceLocationBody) =>
    put<Place>(`/admin/places/${id}/location`, b),
  // The location DELETE returns the updated Place, so it uses `request`
  // directly (the shared `del` returns void).
  deleteLocation: (id: number) =>
    request<Place>({
      method: "DELETE",
      path: `/admin/places/${id}/location`,
    }),
  map: (q: PlaceMapQuery = {}) =>
    get<PlaceMapResponse>("/admin/places/map", {
      eventId: q.eventId,
      from: q.from,
      to: q.to,
    }),
};
