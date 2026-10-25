import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import AgentsPage from "./AgentsPage";
import { buildAgentPrompt } from "./agentPrompt";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

function Harness() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ConfigProvider config={testConfig}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/agents"]}>
            <NotifyProvider>
              <AgentsPage />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/api-keys`, () =>
      HttpResponse.json({ items: [] })
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("AgentsPage", () => {
  it("renders the session steps, the keys table, and the prompt with this environment's base URL", async () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByText("How a session works")).toBeInTheDocument();
    expect(await screen.findByText("No keys yet.")).toBeInTheDocument();
    const block = screen.getByTestId("agent-prompt-block");
    expect(block.textContent).toContain(`Base URL: ${testConfig.apiBaseUrl}`);
    expect(block.textContent).toContain("POST /admin/content/publish");
    expect(screen.getByTestId("copy-prompt-button")).toBeInTheDocument();
  });

  it("the prompt names all 21 capabilities with the routes each reaches", () => {
    const prompt = buildAgentPrompt("https://api.example");
    const caps = [
      "events",
      "routes",
      "maps",
      "themes",
      "beacons",
      "sponsors",
      "cookie_types",
      "pages",
      "sections",
      "site_settings",
      "content",
      "media",
      "icons",
      "settings",
      "contact_messages",
      "subscribers",
      "people",
      "diagnostics",
      "audit",
      "qr",
      "help",
    ];
    expect(caps).toHaveLength(21);
    for (const cap of caps) {
      expect(prompt).toContain(`- \`${cap}\`: `);
      expect(prompt).toContain(`### ${cap}\n`);
    }
    expect(prompt).toContain("There are 21.");
  });

  it("the prompt files section create under pages and the kinds read under content, as the API does", () => {
    const prompt = buildAgentPrompt("https://api.example");
    const lineFor = (cap: string) =>
      prompt.split("\n").find((l) => l.startsWith(`- \`${cap}\`: `)) ?? "";
    expect(lineFor("pages")).toContain("POST /admin/pages/{id}/sections");
    expect(lineFor("sections")).not.toContain("/admin/pages/{id}/sections,");
    expect(lineFor("sections")).toContain("PUT /admin/pages/{id}/sections/order");
    expect(lineFor("sections")).not.toContain("/admin/content/kinds");
    expect(lineFor("content")).toContain("/admin/content/kinds");
    const pagesRef = prompt.slice(prompt.indexOf("### pages\n"), prompt.indexOf("### sections\n"));
    expect(pagesRef).toContain("POST /admin/pages/{id}/sections");
    const contentRef = prompt.slice(prompt.indexOf("### content\n"), prompt.indexOf("### media\n"));
    expect(contentRef).toContain("GET /admin/content/kinds");
  });

  it("the prompt states the paging defaults and the theme body limit the API enforces", () => {
    const prompt = buildAgentPrompt("https://api.example");
    expect(prompt).toContain(
      "limit caps at 500 and defaults to 50 for media and 100 for contact messages, subscribers, people, and event locations"
    );
    expect(prompt).toContain("GET /admin/audit defaults to 50, caps at 200");
    expect(prompt).toContain("1 MB for a theme create or patch");
  });

  it("the page subtitle counts the capabilities the prompt lists", () => {
    render(<Harness />);
    expect(screen.getByText(/the 21 capabilities and the routes/)).toBeInTheDocument();
  });

  it("the prompt lists the five Cognito-only routes", () => {
    const prompt = buildAgentPrompt("https://api.example");
    for (const route of [
      "  - GET /admin/api-keys\n",
      "  - POST /admin/api-keys\n",
      "  - POST /admin/api-keys/{id}/revoke\n",
      "  - GET /admin/api-keys/{id}/impact\n",
      "  - GET /admin/email/quota\n",
    ]) {
      expect(prompt).toContain(route);
    }
  });

  it("the prompt names the POSTs that answer 200", () => {
    const prompt = buildAgentPrompt("https://api.example");
    const line = prompt.split("\n").find((l) => l.includes("These POSTs answer 200, not 201"));
    expect(line).toBeDefined();
    for (const route of [
      "POST /admin/events/{id}/status",
      "POST /admin/events/{id}/current",
      "POST /admin/events/{id}/notify",
      "POST /admin/qr-codes/{id}/attach",
      "POST /admin/qr-codes/{id}/detach",
      "POST /admin/beacons/{id}/activate",
      "POST /admin/beacons/{id}/deactivate",
      "POST /admin/beacons/{id}/rotate",
      "POST /admin/beacons/{id}/revoke",
      "POST /admin/content/versions/{id}/restore",
      "PUT /admin/sponsors/{id}/years/{eventYear}",
      "POST /admin/routes answers 200 with the existing row when an identical recording exists",
    ]) {
      expect(line).toContain(route);
    }
  });

  it("the prompt names the clear current route and the no_event page", () => {
    const prompt = buildAgentPrompt("https://api.example");
    expect(prompt).toContain(
      "- DELETE /admin/events/{id}/current: 200 Event with isCurrent false; no event is current and / renders the no_event page."
    );
    expect(prompt).toContain("with no current event, / renders the no_event page");
  });

  it("the prompt names the new tab link marker and the rich text size", () => {
    const prompt = buildAgentPrompt("https://api.example");
    expect(prompt).toContain("[label](href){newtab} (opens in a new tab");
    expect(prompt).toContain("rich_text data takes textSize normal|large");
  });

  it("the prompt names the optional block align", () => {
    const prompt = buildAgentPrompt("https://api.example");
    expect(prompt).toContain(
      "The heading, paragraph, list, quote, media, and links blocks take an optional align start|center; absent follows the section's presentation.align"
    );
    expect(prompt).toContain("The icon block's align stays required; the divider has none.");
  });

  it("the prompt names the video rules", () => {
    const prompt = buildAgentPrompt("https://api.example");
    expect(prompt).toContain("or video/mp4, and the filename extension must match it (.mp4 for video/mp4)");
    expect(prompt).toContain("500 MB for an MP4 video");
    expect(prompt).toContain("posterMediaId (a video only: another ready raster or gif asset, or null)");
    expect(prompt).toContain("a MediaRef may name a video asset only in a rich_text media block's media and a media section item's media");
    expect(prompt).toContain("a section background, a hero or section icon, any media Icon");
    expect(prompt).toContain("the site settings logo, favicon, and logoMedia");
    expect(prompt).toContain("it never takes darkMediaId or smallMediaId");
    expect(prompt).toContain("kind raster|svg|gif|video");
    expect(prompt).toContain("GET .../usage lists posterOf");
  });

  it("the prompt names the two switches under settings with what each does", () => {
    const prompt = buildAgentPrompt("https://api.example");
    const settings = prompt.slice(prompt.indexOf("### settings\n"));
    const section = settings.slice(0, settings.indexOf("\n### ", 1));
    expect(section).toContain(
      "sign_ups_open bool: whether visitors can create an account on the site."
    );
    expect(section).toContain("502 upstream_failed");
    expect(section).toContain(
      "subscriptions_open bool: whether visitors can add an alert email address."
    );
    expect(section).toContain("409 subscriptions_closed");
  });

  it("the prompt names the heading distance setting and the location CSV columns", () => {
    const prompt = buildAgentPrompt("https://api.example");
    const settings = prompt.slice(prompt.indexOf("### settings\n"));
    const section = settings.slice(0, settings.indexOf("\n### ", 1));
    expect(section).toContain("  - heading_min_distance_m 1..1000 (decimal)\n");
    const line =
      prompt.split("\n").find((l) => l.startsWith("- GET /admin/events/{id}/locations?")) ?? "";
    expect(line).toContain(
      "seq,beaconId,published,recordedAt,receivedAt,lat,lng,speedMps,speedSource,altitudeM,headingDeg,headingSource,accuracyM"
    );
  });

  it("the prompt describes the one site route", () => {
    const prompt = buildAgentPrompt("https://api.example");
    expect(prompt).toContain("route: `{ routeId, mapConfig? }`, the site route");
    expect(prompt).toContain("GET /admin/route: `{ published, draft }`");
    expect(prompt).toContain("Delete is 409 route_in_use while the site settings draft or the newest published version names it");
    expect(prompt).toContain("copy: { sponsors, tracker }");
    expect(prompt).toContain("it carries no route (routeId in a poster write is 400 validation_failed)");
    expect(prompt).toContain("An event has no route field");
    expect(prompt).toContain(
      "2 scheduled needs scheduledAt still ahead (409 scheduled_at_required, 409 scheduled_at_past); 1 planned from 2 clears scheduledAt"
    );
    expect(prompt).toContain(
      "scheduled_at_required, scheduled_at_past, no_healthy_beacon (status change)"
    );
    expect(prompt).toContain("409 year_taken, scheduled_at_required, scheduled_at_past");
  });

  it("the prompt names the map choice on create and clone", () => {
    const prompt = buildAgentPrompt("https://api.example");
    expect(prompt).toContain(
      "scheduleTimeZone?, trackerMapId?, trackerBbox?, trackerStartView? }`: year and name required."
    );
    expect(prompt).toContain(
      "trackerMapId is optional: a ready map's id sets the area to the map's, and a trackerBbox given with it must lie inside the map's area"
    );
    expect(prompt).toContain("null means no map, Google Maps only; absent inherits the map by the rule below.");
    expect(prompt).toContain(
      "copy: { sponsors, tracker }, trackerMapId?, trackerBbox?, trackerStartView? }`: 201, a new planned event."
    );
    expect(prompt).toContain("trackerMapId and trackerBbox are optional and checked as on create.");
    expect(prompt).toContain(
      "tracker copies the source's enabled theme set, and the source's map only when no trackerMapId is given."
    );
    expect(prompt).toContain(
      "- An event created without trackerBbox gets the map's area when a map is named, else the site settings' box."
    );
  });

  it("the prompt names trackerStartView on create, patch, and clone", () => {
    const prompt = buildAgentPrompt("https://api.example");
    expect(prompt).toContain(
      "trackerStartView is optional, where the tracker opens: `{ center: { lat, lng }, zoom }` with zoom an integer 3 to 18 and center inside the event's trackerBbox"
    );
    expect(prompt).toContain("null or absent means none, and the tracker fits the whole box.");
    expect(prompt).toContain(
      "trackerStartView (optional: `{ center: { lat, lng }, zoom 3..18 }` with center inside the event's trackerBbox after this write; null clears it, absent leaves it; a patch that moves trackerBbox and names no trackerStartView has the API clear a stored view its new box leaves outside)"
    );
    expect(prompt).toContain(
      "trackerStartView is optional (center inside the clone's trackerBbox, zoom 3 to 18): a view or null wins; absent copies the source's, which the API clears when the clone's box leaves its center outside."
    );
    expect(prompt).toContain(
      "- An event's trackerStartView centre always lies inside its trackerBbox; a box change that leaves it outside clears it."
    );
  });

  it("the prompt carries none of the stale statements and no dashes", () => {
    const prompt = buildAgentPrompt("https://api.example");
    for (const stale of [
      "SVG only",
      "1 to 100",
      "16 capabilities",
      "There are 19.",
      "tight|normal|loose|none",
      "limit defaults to 50 and caps at 500",
      "backtick code, [label](href), a newline for a line break",
      "inheritRoute true copies the latest event's recording and refuses routeId (400).",
      "Its display comes from the event's routeMapConfig",
      "copy: { sponsors, route, routeMapConfig, tracker }",
      "GET /admin/events/{id}/route-map",
      "locations, route-map) and /admin/posters/*",
      "POST `{ name 1..200, routeId?, layout? }`",
      "Delete unlinks the events and posters that used it.",
      "Attach a recording with PATCH on the event or poster.",
      "a route unlinks events and posters",
      "fundsPercent, routeId, scheduleTimeZone",
      "routeMapConfig (an object or null; unknown fields are 400)",
      "2 scheduled needs scheduledAt (409 scheduled_at_required).",
      "409 year_taken, scheduled_at_required.",
      "scheduleTimeZone?, trackerBbox? }",
      "tracker copies the source's map and enabled theme set; the box always copies.",
      "An event created without trackerBbox gets the site settings' box.",
      "the map and the enabled theme set are copied from the event with the greatest year",
    ]) {
      expect(prompt).not.toContain(stale);
    }
    expect(prompt).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("AgentsPage help buttons (admin.md 6.26)", () => {
  it("mounts the header help and every card help of the default render", async () => {
    render(<Harness />);
    for (const key of ["agents"]) {
      expect(await screen.findByTestId(`help-${key}`)).toBeInTheDocument();
    }
  });
});
