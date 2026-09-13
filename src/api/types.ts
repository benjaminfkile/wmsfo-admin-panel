import type { components } from "./schema";

type S = components["schemas"];

export type Event = S["EventDto"];
export type EventMessage = S["EventMessageDto"];
export type StatusHistory = S["StatusHistoryDto"];
export type Route = S["RouteDto"];
export type Beacon = S["BeaconDto"];
export type Enrollment = S["EnrollmentDto"];
export type BeaconLog = S["BeaconLogDto"];
export type Sponsor = S["SponsorDto"];
export type SponsorYear = S["SponsorYearDto"];
export type SponsorOrderRow = S["SponsorOrderRow"];
export type ApiKey = S["ApiKeyDto"];
export type ApiKeyMinted = S["ApiKeyMintedDto"];
export type ApiKeyCapability =
  | "events"
  | "routes"
  | "beacons"
  | "sponsors"
  | "cookie_types"
  | "pages"
  | "sections"
  | "site_settings"
  | "content"
  | "media"
  | "icons"
  | "settings"
  | "contact_messages"
  | "subscribers"
  | "people"
  | "diagnostics";
export type CookieType = S["CookieTypeDto"];
export type Subscription = S["SubscriptionDto"];
export type SubscriberAdmin = S["SubscriberAdminDto"];
export type Person = S["PersonDto"];
export type ContactMessage = S["ContactMessageDto"];
export type Setting = S["SettingDto"];
export type SnapshotInfo = S["SnapshotInfoDto"];
export type LocationRow = S["LocationRowDto"];
export type PageAdmin = S["PageAdminDto"];
export type PageDetail = S["PageDetailDto"];
export type SectionAdmin = S["SectionAdminDto"];
export type SectionItemAdmin = S["SectionItemAdminDto"];
export type SiteSettingsDraft = S["SiteSettingsDraftDto"];
export type KindInfo = S["KindInfoDto"];
export type IconInfo = S["IconInfoDto"];
export type MediaAsset = S["MediaAssetDto"];
export type UploadTicket = S["UploadTicketDto"];
export type MediaUsage = S["MediaUsageDto"];
export type ContentVersionInfo = S["ContentVersionInfoDto"];
export type ContentStatus = S["ContentStatusDto"];
export type ContentBundle = S["ContentBundleDto"];
export type PreviewToken = S["PreviewTokenDto"];
export type Problem = S["ProblemDto"];
export type ProblemRef = S["ProblemRefDto"];
export type Icon = S["IconValue"];
export type MediaRef = { mediaId: string; alt: string | null };
export type Presentation = S["PresentationDto"];

export type Page<T> = { items: T[]; nextCursor: string | null };
export type StatusId = 1 | 2 | 3 | 4 | 5;

export type LiveObject = {
  schemaVersion: number;
  eventId: number | null;
  eventStatusId: number | null;
  pollIntervalMs: number;
  snapshotUrl: string;
  cookieTally: Record<string, number>;
  seq: number | null;
  lat: number | null;
  lng: number | null;
  speedMps: number | null;
  altitudeM: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  recordedAt: string | null;
  receivedAt: string | null;
  publishedAt: string;
};

export type SocketState =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected";

export type HeartbeatHealth = {
  batteryPercent?: number | null;
  lastFixAgeS?: number | null;
  socketState?: SocketState | null;
};

export type Heartbeat = {
  sentAt: string;
  health: HeartbeatHealth | null;
  debug: Record<string, unknown> | null;
};

export type LiveState = {
  lastWriteAt: string | null;
  lastWriteSeq: number | null;
  lastWriteVersion: number | null;
  lastWriteError: string | null;
  lastWriteNode: string | null;
  node: {
    instance: string | null;
    isLeader: boolean;
    leaderEvaluatedAt: string | null;
    cacheRefreshedAt: string;
    live: LiveObject;
  };
};
