// Fixture-shaped data for MSW handlers. Kept in one place so tests
// can import individual pieces and reason about IDs.

import type {
  ApiKey,
  Beacon,
  BeaconLog,
  ContactMessage,
  ContentBundle,
  ContentStatus,
  ContentVersionInfo,
  CookieType,
  Event,
  EventMessage,
  IconInfo,
  KindInfo,
  LiveObject,
  LiveState,
  LocationRow,
  MediaAsset,
  MediaUsage,
  PageAdmin,
  PageDetail,
  Person,
  PreviewToken,
  Presentation,
  Route,
  SectionAdmin,
  Setting,
  SiteSettingsDraft,
  SnapshotInfo,
  Sponsor,
  SponsorOrderRow,
  StatusHistory,
  SubscriberAdmin,
  Subscription,
  UploadTicket,
} from "../../api/types";

const NOW = "2026-12-22T01:31:07.412Z";
const AUTHOR = "editor@example.com";

export const liveObject: LiveObject = {
  schemaVersion: 1,
  eventId: 7,
  eventStatusId: 3,
  pollIntervalMs: 5000,
  snapshotUrl:
    "https://cdn.example/snapshots/3f9a1c8c1d5e2a7b3f4c9e9a1d2f6e8b4c0a113b7e9c102d4f4a8bb6c19e0b2e1.json",
  cookieTally: { "1": 412, "3": 90 },
  seq: 1832,
  lat: 46.87,
  lng: -114.0,
  speedMps: 31.2,
  altitudeM: 1210,
  headingDeg: 84,
  accuracyM: 6,
  recordedAt: "2026-12-22T01:31:07.000Z",
  receivedAt: "2026-12-22T01:31:07.412Z",
  publishedAt: "2026-12-22T01:31:07.430Z",
};

export const events: Event[] = [
  {
    id: 7,
    year: 2026,
    name: "Santa Flyover 2026",
    statusId: 3,
    isCurrent: true,
    scheduledAt: "2026-12-22T01:00:00.000Z",
    wentLiveAt: "2026-12-22T01:02:11.000Z",
    endedAt: null,
    fundsPercent: 63,
    routeId: 4,
    routeUrl: "https://cdn.example/routes/9c0e77ab.json",
    createdBy: AUTHOR,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 6,
    year: 2025,
    name: "Santa Flyover 2025",
    statusId: 4,
    isCurrent: false,
    scheduledAt: "2025-12-22T01:00:00.000Z",
    wentLiveAt: "2025-12-22T01:02:11.000Z",
    endedAt: "2025-12-22T02:14:00.000Z",
    fundsPercent: 100,
    routeId: 3,
    routeUrl: null,
    createdBy: AUTHOR,
    createdAt: "2025-12-01T00:00:00.000Z",
    updatedAt: "2025-12-22T02:14:00.000Z",
  },
];

export const eventMessages: EventMessage[] = [
  {
    id: 12,
    eventId: 7,
    body: "Santa is airborne over the valley.",
    eventTime: "2026-12-22T01:02:00.000Z",
    createdBy: AUTHOR,
    createdAt: "2026-12-22T01:02:30.000Z",
    updatedAt: "2026-12-22T01:02:30.000Z",
  },
];

export const statusHistory: StatusHistory[] = [
  {
    id: 1,
    eventId: 7,
    fromStatusId: 2,
    toStatusId: 3,
    changedBy: AUTHOR,
    changedAt: "2026-12-22T01:02:11.000Z",
  },
];

export const locations: LocationRow[] = [
  {
    seq: 1832,
    beaconId: 5,
    published: true,
    recordedAt: "2026-12-22T01:31:07.000Z",
    receivedAt: "2026-12-22T01:31:07.412Z",
    lat: 46.87,
    lng: -114.0,
    speedMps: 31.2,
    altitudeM: 1210,
    headingDeg: 84,
    accuracyM: 6,
  },
];

export const routes: Route[] = [
  {
    id: 4,
    name: "2026 draft",
    url: "https://cdn.example/routes/9c0e77ab.json",
    s3Key: "routes/9c0e77ab.json",
    sha256: "9c0e77ab" + "0".repeat(56),
    pointCount: 42,
    uploadedBy: AUTHOR,
    createdAt: NOW,
  },
];

export const beacons: Beacon[] = [
  {
    id: 5,
    name: "Helicopter phone",
    notes: "primary",
    keyPrefix: "wbk_abcdef012",
    isActive: true,
    revokedAt: null,
    lastSeenAt: NOW,
    lastLocationAt: NOW,
    lastHeartbeatAt: NOW,
    staleSince: null,
    telemetry: null,
    hubConnected: true,
    healthy: true,
    createdBy: AUTHOR,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const beaconLogs: BeaconLog[] = [
  { id: 17, receivedAt: NOW, appVersion: "1.0.3", sizeBytes: 183422 },
];

export const sponsors: Sponsor[] = [
  {
    id: 4,
    name: "Example Bakery",
    contactPerson: null,
    email: "hello@example.com",
    phone: null,
    address: null,
    websiteUrl: "https://example.com",
    fbUrl: null,
    igUrl: "https://instagram.com/example",
    logoMediaId: "8c1d5e2a-7b3f-4c9e-9a1d-2f6e8b4c0a11",
    logo: null,
    years: [
      {
        eventYear: 2026,
        amountDonated: 500,
        active: true,
        canAdvertise: true,
        anonymous: false,
        pinnedPosition: null,
        lingerMsOverride: null,
        lingerMs: 20000,
        registeredAt: NOW,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const sponsorOrderRows: SponsorOrderRow[] = [
  {
    sponsorId: 4,
    name: "Example Bakery",
    pinnedPosition: 1,
    amountDonated: 500,
    lingerMs: 20000,
    lingerMsOverride: null,
    inSnapshot: true,
  },
  {
    sponsorId: 5,
    name: "Cheer Cafe",
    pinnedPosition: null,
    amountDonated: 250,
    lingerMs: 10000,
    lingerMsOverride: null,
    inSnapshot: true,
  },
  {
    sponsorId: 6,
    name: "Anonymous Neighbour",
    pinnedPosition: null,
    amountDonated: 100,
    lingerMs: 4000,
    lingerMsOverride: null,
    inSnapshot: false,
  },
];

export const cookieTypes: CookieType[] = [
  {
    id: 1,
    name: "Chocolate chip",
    icon: { source: "library", id: "cookie" },
    sort: 10,
    active: true,
    cookieCount: 412,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 3,
    name: "Gingerbread",
    icon: {
      source: "media",
      id: "3b7e9c10-2d4f-4a8b-b6c1-9e0f7d5a2c33",
    },
    sort: 20,
    active: true,
    cookieCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const subscriptions: Subscription[] = [
  {
    id: 1,
    channel: "email",
    address: "person@example.com",
    verifiedAt: NOW,
    unsubscribedAt: null,
    createdAt: NOW,
  },
];

export const subscribers: SubscriberAdmin[] = [
  {
    ...subscriptions[0],
    personId: 1,
    personEmail: "person@example.com",
  },
];

export const people: (Person & { cookieCount: number })[] = [
  { id: 1, email: "person@example.com", createdAt: NOW, lastSeenAt: NOW, cookieCount: 4 },
];

export const contactMessages: ContactMessage[] = [
  {
    id: 12,
    name: "Jane Doe",
    email: "jane@example.com",
    body: "Hello",
    clientIp: "203.0.113.5",
    createdAt: NOW,
  },
];

export const settings: Setting[] = [
  { key: "poll_interval_ms", value: 5000, updatedBy: AUTHOR, updatedAt: NOW },
  { key: "cookie_limit_per_person", value: 10, updatedBy: AUTHOR, updatedAt: NOW },
  {
    key: "sponsor_linger_ms_per_dollar",
    value: 40,
    updatedBy: AUTHOR,
    updatedAt: NOW,
  },
  {
    key: "sponsor_linger_min_ms",
    value: 2000,
    updatedBy: AUTHOR,
    updatedAt: NOW,
  },
  {
    key: "beacon_stale_after_s",
    value: 45,
    updatedBy: AUTHOR,
    updatedAt: NOW,
  },
  {
    key: "flight_history_max_points",
    value: 2000,
    updatedBy: AUTHOR,
    updatedAt: NOW,
  },
];

export const snapshotInfo: SnapshotInfo = {
  version: 42,
  url: liveObject.snapshotUrl,
  s3Key: "snapshots/3f9a1c...json",
  builtAt: NOW,
};

export const liveState: LiveState = {
  lastWriteAt: NOW,
  lastWriteSeq: liveObject.seq,
  lastWriteVersion:
    typeof snapshotInfo.version === "number" ? snapshotInfo.version : 42,
  lastWriteError: null,
  lastWriteNode: "node-1",
  node: {
    instance: "instance-a",
    isLeader: true,
    leaderEvaluatedAt: NOW,
    cacheRefreshedAt: NOW,
    live: liveObject,
  },
};

const defaultPresentation: Presentation = {
  width: "wide",
  align: "start",
  background: { kind: "none" },
  spacing: "normal",
  iconBefore: null,
  iconAfter: null,
  anchor: null,
} as unknown as Presentation;

export const pageAdmin: PageAdmin[] = [
  {
    id: 1,
    slug: "no-event",
    title: "No event",
    navLabel: null,
    navPosition: 0,
    isHidden: false,
    role: "no_event",
    sectionCount: 1,
    problemCount: 0,
    createdBy: AUTHOR,
    createdAt: NOW,
    updatedBy: AUTHOR,
    updatedAt: NOW,
  },
  {
    id: 3,
    slug: "about",
    title: "About",
    navLabel: "About",
    navPosition: 10,
    isHidden: false,
    role: "none",
    sectionCount: 2,
    problemCount: 0,
    createdBy: AUTHOR,
    createdAt: NOW,
    updatedBy: AUTHOR,
    updatedAt: NOW,
  },
];

export const sampleSection: SectionAdmin = {
  id: 9,
  pageId: 3,
  kind: "rich_text",
  position: 0,
  isHidden: false,
  data: { blocks: [{ kind: "paragraph", text: "Hello" }] },
  presentation: defaultPresentation,
  items: [],
  problems: [],
  updatedBy: AUTHOR,
  updatedAt: NOW,
};

export const pageDetail: PageDetail = {
  ...(pageAdmin[1] ?? pageAdmin[0]),
  sections: [sampleSection],
};

export const siteSettingsDraft: SiteSettingsDraft = {
  data: { siteName: "Western Montana Santa Flyover" },
  problems: [],
  updatedBy: AUTHOR,
  updatedAt: NOW,
};

export const kinds: KindInfo[] = [
  {
    kind: "rich_text",
    title: "Rich text",
    description: "Formatted paragraphs.",
    live: false,
    hasItems: false,
    allowedRoles: null,
    schema: {},
    itemSchema: null,
    defaults: { blocks: [] },
    itemDefaults: null,
  },
];

export const iconInfos: IconInfo[] = [
  {
    id: "cookie",
    name: "Cookie",
    tags: ["food"],
    url: "https://cdn.example/icons/bb22.svg",
  },
];

export const mediaAssets: MediaAsset[] = [
  {
    id: "8c1d5e2a-7b3f-4c9e-9a1d-2f6e8b4c0a11",
    filename: "hangar.jpg",
    contentType: "image/jpeg",
    kind: "raster",
    state: "ready",
    sizeBytes: 1834211,
    width: 2400,
    height: 1600,
    sha256: "8c1d" + "0".repeat(60),
    alt: "The helicopter in its hangar",
    title: "Hangar",
    url: "https://cdn.example/media/8c1d5e2a-7b3f-4c9e-9a1d-2f6e8b4c0a11/hangar.jpg",
    variants: {
      "480": "https://cdn.example/media/8c1d5e2a/w480.webp",
      "960": "https://cdn.example/media/8c1d5e2a/w960.webp",
      "1600": "https://cdn.example/media/8c1d5e2a/w1600.webp",
    },
    uploadedBy: AUTHOR,
    createdAt: NOW,
    confirmedAt: NOW,
    unreferencedSince: null,
    orphanedAt: null,
  },
];

export const mediaUsage: MediaUsage = {
  draftPages: [],
  versionCount: 1,
  sponsors: [{ id: 4, name: "Example Bakery" }],
  cookieTypes: [],
  siteSettings: false,
};

export const uploadTicket: UploadTicket = {
  media: mediaAssets[0],
  uploadUrl: "https://s3.example/upload",
  method: "PUT",
  headers: { "Content-Type": "image/jpeg", "x-amz-tagging": "state=pending" },
  expiresAt: NOW,
};

export const contentStatus: ContentStatus = {
  published: {
    id: 1,
    sha256: "abc" + "0".repeat(61),
    label: "Seed",
    publishedBy: AUTHOR,
    publishedAt: NOW,
    pageCount: 7,
    sectionCount: 12,
  },
  draftSha256: "abc" + "0".repeat(61),
  hasUnpublishedChanges: false,
  problems: [],
  draftUpdatedAt: NOW,
};

export const contentVersions: ContentVersionInfo[] = [
  {
    id: 1,
    sha256: "abc" + "0".repeat(61),
    label: "Seed",
    publishedBy: AUTHOR,
    publishedAt: NOW,
    pageCount: 7,
    sectionCount: 12,
  },
];

export const contentBundle: ContentBundle = {
  content: {
    schemaVersion: 1,
    settings: { siteName: "Western Montana Santa Flyover" },
    pages: [],
  },
  media: {},
  icons: {},
};

export const apiKeys: ApiKey[] = [
  {
    id: 11,
    name: "claude-code",
    keyPrefix: "wak_abcdef012",
    allCapabilities: false,
    capabilities: ["pages", "sections", "content", "media"],
    expiresAt: "2027-01-31T00:00:00.000Z",
    createdBy: AUTHOR,
    createdAt: NOW,
    lastUsedAt: NOW,
    revokedAt: null,
  },
  {
    id: 12,
    name: "posting-bot",
    keyPrefix: "wak_defabc345",
    allCapabilities: true,
    capabilities: [],
    expiresAt: null,
    createdBy: AUTHOR,
    createdAt: "2026-11-10T00:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
  },
];

export const previewToken: PreviewToken = {
  token: "wpv_" + "a".repeat(43),
  url: "https://site.example/preview?token=wpv_" + "a".repeat(43),
  expiresAt: NOW,
};
