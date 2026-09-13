import { http, HttpResponse, type HttpHandler } from "msw";
import * as f from "./fixtures";

// Handlers cover every endpoint the admin panel calls (admin.md 4.4).
// Bodies are shaped from the vendored fixtures; ids come back as
// numeric literals so tests can assert on shape without needing the
// real API. Reads return the fixture; writes echo the fixture back
// with a stable id where a new row would be created.

const page = <T>(items: T[]) => ({ items, nextCursor: null });

export const handlers: HttpHandler[] = [
  // Events
  http.get("*/admin/events", () => HttpResponse.json({ items: f.events })),
  http.post("*/admin/events", async () => HttpResponse.json(f.events[0], { status: 201 })),
  http.get("*/admin/events/:id", ({ params }) => {
    const id = Number(params.id);
    const evt = f.events.find((e) => e.id === id) ?? f.events[0];
    return HttpResponse.json(evt);
  }),
  http.patch("*/admin/events/:id", () => HttpResponse.json(f.events[0])),
  http.delete("*/admin/events/:id", () => new HttpResponse(null, { status: 204 })),
  http.post("*/admin/events/:id/current", () => HttpResponse.json(f.events[0])),
  http.post("*/admin/events/:id/status", () => HttpResponse.json(f.events[0])),
  http.get("*/admin/events/:id/status-history", () =>
    HttpResponse.json({ items: f.statusHistory })
  ),
  http.get("*/admin/events/:id/messages", () =>
    HttpResponse.json({ items: f.eventMessages })
  ),
  http.post("*/admin/events/:id/messages", () =>
    HttpResponse.json(f.eventMessages[0], { status: 201 })
  ),
  http.patch("*/admin/events/:id/messages/:mid", () =>
    HttpResponse.json(f.eventMessages[0])
  ),
  http.delete("*/admin/events/:id/messages/:mid", () => new HttpResponse(null, { status: 204 })),
  http.get("*/admin/events/:id/locations", ({ request }) => {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/csv")) {
      const header = "seq,beaconId,published,recordedAt,receivedAt,lat,lng,speedMps,altitudeM,headingDeg,accuracyM";
      const row = f.locations
        .map((l) =>
          [
            l.seq,
            l.beaconId,
            l.published,
            l.recordedAt,
            l.receivedAt,
            l.lat,
            l.lng,
            l.speedMps,
            l.altitudeM,
            l.headingDeg,
            l.accuracyM,
          ].join(",")
        )
        .join("\r\n");
      return new HttpResponse(`${header}\r\n${row}\r\n`, {
        headers: { "Content-Type": "text/csv" },
      });
    }
    return HttpResponse.json(page(f.locations));
  }),

  // Routes
  http.get("*/admin/routes", () => HttpResponse.json({ items: f.routes })),
  http.get("*/admin/routes/:id", () => HttpResponse.json(f.routes[0])),
  http.post("*/admin/routes", () => HttpResponse.json(f.routes[0], { status: 201 })),
  http.post("*/admin/routes/from-event/:eventId", () =>
    HttpResponse.json(f.routes[0], { status: 201 })
  ),
  http.delete("*/admin/routes/:id", () => new HttpResponse(null, { status: 204 })),

  // Beacons
  http.get("*/admin/beacons", () =>
    HttpResponse.json({ items: f.beacons, staleAfterS: 45 })
  ),
  http.get("*/admin/beacons/:id", () => HttpResponse.json(f.beacons[0])),
  http.post("*/admin/beacons", () =>
    HttpResponse.json(
      {
        beacon: f.beacons[0],
        key: "wbk_" + "a".repeat(43),
        enrollment: {
          token: "wet_" + "a".repeat(43),
          url: "https://api.example/enroll",
          qrPngDataUrl: "data:image/png;base64,AAAA",
          expiresAt: "2026-12-22T02:00:00.000Z",
        },
      },
      { status: 201 }
    )
  ),
  http.patch("*/admin/beacons/:id", () => HttpResponse.json(f.beacons[0])),
  http.post("*/admin/beacons/:id/activate", () => HttpResponse.json(f.beacons[0])),
  http.post("*/admin/beacons/:id/deactivate", () => HttpResponse.json(f.beacons[0])),
  http.post("*/admin/beacons/:id/rotate", () =>
    HttpResponse.json({
      beacon: f.beacons[0],
      key: "wbk_" + "b".repeat(43),
      enrollment: {
        token: "wet_" + "b".repeat(43),
        url: "https://api.example/enroll",
        qrPngDataUrl: "data:image/png;base64,BBBB",
        expiresAt: "2026-12-22T02:00:00.000Z",
      },
    })
  ),
  http.post("*/admin/beacons/:id/revoke", () => HttpResponse.json(f.beacons[0])),
  http.get("*/admin/beacons/:id/logs", () => HttpResponse.json({ items: f.beaconLogs })),
  http.get(
    "*/admin/beacons/:id/logs/:logId",
    () => new HttpResponse("log body", { headers: { "Content-Type": "text/plain" } })
  ),

  // Sponsors
  http.get("*/admin/sponsors", () => HttpResponse.json({ items: f.sponsors })),
  http.get("*/admin/sponsors/:id", () => HttpResponse.json(f.sponsors[0])),
  http.post("*/admin/sponsors", () => HttpResponse.json(f.sponsors[0], { status: 201 })),
  http.patch("*/admin/sponsors/:id", () => HttpResponse.json(f.sponsors[0])),
  http.delete("*/admin/sponsors/:id", () => new HttpResponse(null, { status: 204 })),
  http.get("*/admin/sponsors/order/:eventYear", () =>
    HttpResponse.json({ items: f.sponsorOrderRows })
  ),
  http.put("*/admin/sponsors/order/:eventYear", () =>
    HttpResponse.json({ items: f.sponsorOrderRows })
  ),
  http.put("*/admin/sponsors/:id/years/:eventYear", () =>
    HttpResponse.json(f.sponsors[0])
  ),
  http.delete("*/admin/sponsors/:id/years/:eventYear", () => new HttpResponse(null, { status: 204 })),

  // Cookie types
  http.get("*/admin/cookie-types", () => HttpResponse.json({ items: f.cookieTypes })),
  http.post("*/admin/cookie-types", () =>
    HttpResponse.json(f.cookieTypes[0], { status: 201 })
  ),
  http.patch("*/admin/cookie-types/:id", () => HttpResponse.json(f.cookieTypes[0])),
  http.delete("*/admin/cookie-types/:id", () => new HttpResponse(null, { status: 204 })),

  // Settings
  http.get("*/admin/settings", () => HttpResponse.json({ items: f.settings })),
  http.put("*/admin/settings/:key", () => HttpResponse.json(f.settings[0])),

  // Subscribers
  http.get("*/admin/subscribers/summary", () =>
    HttpResponse.json({ verified: 812, pending: 40, unsubscribed: 12 })
  ),
  http.get("*/admin/subscribers", () => HttpResponse.json(page(f.subscribers))),
  http.delete("*/admin/subscribers/:id", () => new HttpResponse(null, { status: 204 })),

  // People
  http.get("*/admin/people", () => HttpResponse.json(page(f.people))),
  http.delete("*/admin/people/:id", () => new HttpResponse(null, { status: 204 })),

  // Contact messages
  http.get("*/admin/contact-messages", () => HttpResponse.json(page(f.contactMessages))),
  http.delete("*/admin/contact-messages/:id", () => new HttpResponse(null, { status: 204 })),

  // Snapshot
  http.get("*/admin/snapshot", () => HttpResponse.json(f.snapshotInfo)),
  http.post("*/admin/snapshot/rebuild", () => HttpResponse.json(f.snapshotInfo)),

  // Live diagnostics
  http.get("*/admin/live", () => HttpResponse.json(f.liveState)),
  http.post("*/admin/live/republish", () => HttpResponse.json(f.liveObject)),

  // Pages
  http.get("*/admin/pages", () => HttpResponse.json({ items: f.pageAdmin })),
  http.get("*/admin/pages/:id", () => HttpResponse.json(f.pageDetail)),
  http.post("*/admin/pages", () => HttpResponse.json(f.pageAdmin[1], { status: 201 })),
  http.patch("*/admin/pages/:id", () => HttpResponse.json(f.pageAdmin[1])),
  http.delete("*/admin/pages/:id", () => new HttpResponse(null, { status: 204 })),
  http.put("*/admin/pages/order", () =>
    HttpResponse.json({ items: f.pageAdmin })
  ),

  // Sections
  http.get("*/admin/content/kinds", () => HttpResponse.json({ items: f.kinds })),
  http.post("*/admin/pages/:id/sections", () =>
    HttpResponse.json(f.sampleSection, { status: 201 })
  ),
  http.patch("*/admin/sections/:id", () =>
    HttpResponse.json(f.sampleSection)
  ),
  http.delete("*/admin/sections/:id", () => new HttpResponse(null, { status: 204 })),
  http.post("*/admin/sections/:id/duplicate", () =>
    HttpResponse.json(f.sampleSection, { status: 201 })
  ),
  http.post("*/admin/sections/:id/move", () =>
    HttpResponse.json(f.sampleSection)
  ),
  http.put("*/admin/pages/:id/sections/order", () =>
    HttpResponse.json(f.pageDetail)
  ),
  http.post("*/admin/sections/:id/items", () =>
    HttpResponse.json(
      {
        id: 1,
        sectionId: 9,
        position: 0,
        isHidden: false,
        data: {},
        problems: [],
        updatedBy: "editor@example.com",
        updatedAt: "2026-12-22T01:31:07.412Z",
      },
      { status: 201 }
    )
  ),
  http.patch("*/admin/items/:id", () =>
    HttpResponse.json({
      id: 1,
      sectionId: 9,
      position: 0,
      isHidden: false,
      data: {},
      problems: [],
      updatedBy: "editor@example.com",
      updatedAt: "2026-12-22T01:31:07.412Z",
    })
  ),
  http.delete("*/admin/items/:id", () => new HttpResponse(null, { status: 204 })),
  http.put("*/admin/sections/:id/items/order", () =>
    HttpResponse.json(f.sampleSection)
  ),

  // Site settings
  http.get("*/admin/site-settings", () => HttpResponse.json(f.siteSettingsDraft)),
  http.put("*/admin/site-settings", () => HttpResponse.json(f.siteSettingsDraft)),

  // Content
  http.get("*/admin/content/status", () => HttpResponse.json(f.contentStatus)),
  http.get("*/admin/content/draft", () => HttpResponse.json(f.contentBundle)),
  http.post("*/admin/content/publish", () =>
    HttpResponse.json(f.contentVersions[0], { status: 201 })
  ),
  http.get("*/admin/content/versions", () =>
    HttpResponse.json({ items: f.contentVersions })
  ),
  http.get("*/admin/content/versions/:id", () =>
    HttpResponse.json({ ...f.contentVersions[0], document: f.contentBundle.content })
  ),
  http.post("*/admin/content/versions/:id/restore", () =>
    HttpResponse.json(f.contentStatus)
  ),
  http.post("*/admin/content/preview-token", () =>
    HttpResponse.json(f.previewToken, { status: 201 })
  ),

  // Icons
  http.get("*/admin/icons", () => HttpResponse.json({ items: f.iconInfos })),

  // Media
  http.get("*/admin/media", () => HttpResponse.json(page(f.mediaAssets))),
  http.get("*/admin/media/:id", () => HttpResponse.json(f.mediaAssets[0])),
  http.get("*/admin/media/:id/usage", () => HttpResponse.json(f.mediaUsage)),
  http.post("*/admin/media/upload-url", () =>
    HttpResponse.json(f.uploadTicket, { status: 201 })
  ),
  http.post("*/admin/media/:id/confirm", () =>
    HttpResponse.json(f.mediaAssets[0])
  ),
  http.patch("*/admin/media/:id", () => HttpResponse.json(f.mediaAssets[0])),
  http.delete("*/admin/media/:id", () => new HttpResponse(null, { status: 204 })),

  // API keys
  http.get("*/admin/api-keys", () =>
    HttpResponse.json({ items: f.apiKeys })
  ),
  http.post("*/admin/api-keys", () =>
    HttpResponse.json(
      {
        ...f.apiKeys[0],
        key: "wak_" + "a".repeat(43),
      },
      { status: 201 }
    )
  ),
  http.post("*/admin/api-keys/:id/revoke", () =>
    HttpResponse.json({ ...f.apiKeys[0], revokedAt: "2026-12-22T02:00:00.000Z" })
  ),

  // CDN read (not an admin API path but the panel dashboard fetches it)
  http.get("*/live/location.json", () => HttpResponse.json(f.liveObject)),
];
