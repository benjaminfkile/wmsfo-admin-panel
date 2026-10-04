import { del, get, patch, post, request } from "../client";
import type { DeleteImpact } from "../impact";
import type { RouteMapConfigValue } from "../../routeMap/eventRouteMap";
import type {
  Event,
  EventMessage,
  LocationRow,
  Page,
  RouteMapResponse,
  SeedCookiesRequest,
  SeedCookiesResponse,
  StatusHistory,
  StatusId,
} from "../types";

export type CreateEventBody = {
  year: number;
  name: string;
  scheduledAt: string | null;
  fundsPercent: number;
  routeId: number | null;
  inheritRoute: boolean;
  scheduleTimeZone: string | null;
};

export type PatchEventBody = Partial<{
  name: string;
  year: number;
  scheduledAt: string | null;
  scheduleTimeZone: string | null;
  wentLiveAt: string | null;
  endedAt: string | null;
  fundsPercent: number;
  routeId: number | null;
  routeImageMediaId: string;
  routeMapConfig: RouteMapConfigValue | null;
}>;

export type CloneEventBody = {
  year: number;
  name: string;
  copy: {
    sponsors: boolean;
    route: boolean;
    poster: boolean;
    routeMapConfig: boolean;
  };
};

export type StatusBody = {
  statusId: StatusId;
  notify: boolean;
  message: string | null;
};

export type NotifyBody = { message: string | null };

export type MessageBody = {
  body: string;
  notify: boolean;
};

export type LocationsQuery = {
  cursor?: string;
  limit?: number;
  beaconId?: number;
  publishedOnly?: boolean;
};

export const events = {
  list: () => get<{ items: Event[] }>("/admin/events"),
  get: (id: number) => get<Event>(`/admin/events/${id}`),
  create: (b: CreateEventBody) => post<Event>("/admin/events", b),
  patch: (id: number, b: PatchEventBody) =>
    patch<Event>(`/admin/events/${id}`, b),
  remove: (id: number) => del(`/admin/events/${id}`),
  routeMap: (id: number) =>
    get<RouteMapResponse>(`/admin/events/${id}/route-map`),
  setCurrent: (id: number) => post<Event>(`/admin/events/${id}/current`),
  clone: (id: number, b: CloneEventBody) =>
    post<Event>(`/admin/events/${id}/clone`, b),
  setStatus: (id: number, b: StatusBody) =>
    post<Event>(`/admin/events/${id}/status`, b),
  notify: (id: number, b: NotifyBody) =>
    post<Event>(`/admin/events/${id}/notify`, b),
  statusHistory: (id: number) =>
    get<{ items: StatusHistory[] }>(`/admin/events/${id}/status-history`),
  messages: (id: number) =>
    get<{ items: EventMessage[] }>(`/admin/events/${id}/messages`),
  postMessage: (id: number, b: MessageBody) =>
    post<EventMessage>(`/admin/events/${id}/messages`, b),
  patchMessage: (
    id: number,
    mid: number,
    b: Pick<MessageBody, "body">
  ) => patch<EventMessage>(`/admin/events/${id}/messages/${mid}`, b),
  deleteMessage: (id: number, mid: number) =>
    del(`/admin/events/${id}/messages/${mid}`),
  locations: (id: number, q: LocationsQuery) =>
    get<Page<LocationRow>>(`/admin/events/${id}/locations`, q),
  locationsCsv: (id: number, q: Omit<LocationsQuery, "cursor" | "limit">) =>
    request<Blob>({
      method: "GET",
      path: `/admin/events/${id}/locations`,
      query: q,
      accept: "text/csv",
      parse: "blob",
    }),
  locationsImpact: (id: number) =>
    get<DeleteImpact>(`/admin/events/${id}/locations/impact`),
  clearLocations: (id: number, beaconId?: number) =>
    del(
      `/admin/events/${id}/locations${
        typeof beaconId === "number" ? `?beaconId=${beaconId}` : ""
      }`
    ),
  seedCookies: (id: number, b: SeedCookiesRequest) =>
    post<SeedCookiesResponse>(`/admin/events/${id}/cookies`, b),
};
