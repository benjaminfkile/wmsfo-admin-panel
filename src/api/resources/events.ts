import { del, get, patch, post, request } from "../client";
import type {
  CookieAdmin,
  Event,
  EventMessage,
  LocationRow,
  Page,
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
};

export type PatchEventBody = Partial<{
  name: string;
  year: number;
  scheduledAt: string | null;
  wentLiveAt: string | null;
  endedAt: string | null;
  fundsPercent: number;
  routeId: number | null;
}>;

export type StatusBody = { statusId: StatusId; notify: boolean };

export type MessageBody = {
  body: string;
  eventTime: string | null;
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
  setCurrent: (id: number) => post<Event>(`/admin/events/${id}/current`),
  setStatus: (id: number, b: StatusBody) =>
    post<Event>(`/admin/events/${id}/status`, b),
  statusHistory: (id: number) =>
    get<{ items: StatusHistory[] }>(`/admin/events/${id}/status-history`),
  messages: (id: number) =>
    get<{ items: EventMessage[] }>(`/admin/events/${id}/messages`),
  postMessage: (id: number, b: MessageBody) =>
    post<EventMessage>(`/admin/events/${id}/messages`, b),
  patchMessage: (
    id: number,
    mid: number,
    b: Partial<Pick<MessageBody, "body" | "eventTime">>
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
  cookies: (
    id: number,
    q: { cursor?: string; limit?: number; includeHidden?: boolean }
  ) => get<Page<CookieAdmin>>(`/admin/events/${id}/cookies`, q),
};
