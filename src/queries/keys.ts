import type { LocationsQuery } from "../api/resources/events";
import type { MediaQuery } from "../api/resources/media";
import type { SubscriberStatus } from "../api/resources/subscribers";

export const keys = {
  events: ["events"] as const,
  event: (id: number) => ["events", id] as const,
  eventHistory: (id: number) => ["events", id, "history"] as const,
  eventMessages: (id: number) => ["events", id, "messages"] as const,
  eventCookies: (id: number, includeHidden: boolean) =>
    ["events", id, "cookies", includeHidden] as const,
  eventLocations: (id: number, q: LocationsQuery) =>
    ["events", id, "locations", q] as const,
  routes: ["routes"] as const,
  beacons: ["beacons"] as const,
  beaconLogs: (id: number) => ["beacons", id, "logs"] as const,
  sponsors: ["sponsors"] as const,
  sponsor: (id: number) => ["sponsors", id] as const,
  cookieTypes: ["cookie-types"] as const,
  settings: ["settings"] as const,
  subscribersSummary: ["subscribers", "summary"] as const,
  subscribers: (status: SubscriberStatus | undefined) =>
    ["subscribers", "list", status ?? "all"] as const,
  people: ["people"] as const,
  contactMessages: ["contact-messages"] as const,
  snapshot: ["snapshot"] as const,
  live: ["live"] as const,
  cdnLive: ["cdn-live"] as const,
  pages: ["pages"] as const,
  page: (id: number) => ["pages", id] as const,
  kinds: ["content", "kinds"] as const,
  icons: ["icons"] as const,
  contentStatus: ["content", "status"] as const,
  versions: ["content", "versions"] as const,
  siteSettings: ["site-settings"] as const,
  media: (q: MediaQuery) => ["media", q] as const,
  mediaOne: (id: string) => ["media", "one", id] as const,
  mediaUsage: (id: string) => ["media", "usage", id] as const,
  apiKeys: ["api-keys"] as const,
};
