import { del, get, post } from "../client";
import type { Route, RouteMapResponse, SiteRoute } from "../types";

export type RoutePoint = {
  lat: number;
  lng: number;
  recordedAt: string | null;
};

export type RouteUploadBody = { name: string; points: RoutePoint[] };

export const routes = {
  // The site route (settings.route): the published one with its map, and
  // the draft one without.
  site: () => get<SiteRoute>("/admin/route"),
  list: () => get<{ items: Route[] }>("/admin/routes"),
  get: (id: number) => get<Route>(`/admin/routes/${id}`),
  create: (b: RouteUploadBody) => post<Route>("/admin/routes", b),
  fromEvent: (eventId: number, b: { name: string }) =>
    post<Route>(`/admin/routes/from-event/${eventId}`, b),
  remove: (id: number) => del(`/admin/routes/${id}`),
  routeMap: (id: number) =>
    get<RouteMapResponse>(`/admin/routes/${id}/route-map`),
};
