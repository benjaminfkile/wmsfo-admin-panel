import { del, get, patch, post, request } from "../client";
import type { DeleteImpact } from "../impact";
import type { Bbox } from "../../validation/bbox";
import type { StartView } from "../../components/events/startView";
import type {
  Event,
  EventMessage,
  LocationRow,
  Page,
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
  scheduleTimeZone: string | null;
  // A ready map's id (the box must lie inside its area), or null for no
  // map; absent inherits by the API's rule.
  trackerMapId?: number | null;
  trackerBbox: Bbox | null;
  // Where the tracker opens, the centre inside the box; absent or null
  // for none (the tracker fits the box).
  trackerStartView?: StartView | null;
};

export type PatchEventBody = Partial<{
  name: string;
  year: number;
  scheduledAt: string | null;
  scheduleTimeZone: string | null;
  wentLiveAt: string | null;
  endedAt: string | null;
  fundsPercent: number;
  trackerBbox: Bbox;
  trackerMapId: number | null;
  // A view sets it, null clears it; a box change that leaves a stored
  // view outside clears it in the API.
  trackerStartView: StartView | null;
  trackerThemeIds: number[];
}>;

export type CloneEventBody = {
  year: number;
  name: string;
  copy: {
    sponsors: boolean;
    // The source's theme set, and its map only when no `trackerMapId`
    // is given.
    tracker: boolean;
  };
  trackerMapId?: number | null;
  trackerBbox?: Bbox | null;
  // A view or null wins; absent copies the source's.
  trackerStartView?: StartView | null;
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
  setCurrent: (id: number) => post<Event>(`/admin/events/${id}/current`),
  clearCurrent: (id: number) =>
    request<Event>({ method: "DELETE", path: `/admin/events/${id}/current` }),
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
