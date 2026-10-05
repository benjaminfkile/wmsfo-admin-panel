// admin.md 6.16: the Places on the maps field of Site settings, two
// PoisEditor groups saved under `places.tracker` and `places.routeMap`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import { kindsFor } from "../../components/content/places";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("../places/googleMaps", () => ({
  loadMaps: vi.fn(async () => {
    throw new Error("Maps unavailable in tests");
  }),
  loadMarkers: vi.fn(async () => ({})),
  loadPlaces: vi.fn(async () => ({})),
}));

import SiteSettings from "./SiteSettings";

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
          <MemoryRouter initialEntries={["/site-settings"]}>
            <NotifyProvider>
              <SiteSettings />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const DRAFT = {
  siteName: "Western Montana Santa Flyover",
  tagline: null,
  homeNavLabel: "Home",
  logo: null,
  favicon: null,
  theme: { snowDefault: false, lightsDefault: true },
  navExtraLinks: [],
  footerLinks: [],
  footerText: null,
  contactEmail: null,
  donateUrl: null,
  analyticsEnabled: false,
};

let saved: Array<Record<string, unknown>> = [];

function serve(places?: unknown) {
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
      HttpResponse.json({
        ...f.siteSettingsDraft,
        data: places === undefined ? DRAFT : { ...DRAFT, places },
      })
    ),
    http.put(`${testConfig.apiBaseUrl}/admin/site-settings`, async ({ request }) => {
      const body = (await request.json()) as { data: Record<string, unknown> };
      saved.push(body.data);
      return HttpResponse.json({ ...f.siteSettingsDraft, data: body.data });
    })
  );
}

async function renderPage(places?: unknown) {
  serve(places);
  render(<Harness />);
  await screen.findByDisplayValue("Western Montana Santa Flyover");
  const field = screen.getByTestId("places-field");
  return {
    field,
    tracker: within(field).getByTestId("places-tracker"),
    routeMap: within(field).getByTestId("places-route-map"),
  };
}

// Saves and returns the document the PUT carried.
async function save(): Promise<Record<string, unknown>> {
  const button = screen.getByTestId("site-settings-save");
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  await waitFor(() => expect(saved.length).toBeGreaterThan(0));
  return JSON.parse(JSON.stringify(saved.at(-1))) as Record<string, unknown>;
}

beforeEach(() => {
  saved = [];
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  server.resetHandlers();
});

describe("Site settings: the Places on the maps field", () => {
  it("reads absent as Default in both groups, with the labels and help", async () => {
    const { field, tracker, routeMap } = await renderPage();
    expect(within(field).getByText("Places on the maps")).toBeInTheDocument();
    expect(
      within(field).getByText(
        "Which places each map labels. The two lists differ because the two maps sort places differently."
      )
    ).toBeInTheDocument();
    expect(within(tracker).getByText("Live tracker")).toBeInTheDocument();
    expect(
      within(tracker).getByText(
        "Default shows the places the map style draws. Custom shows only the kinds you check."
      )
    ).toBeInTheDocument();
    expect(within(routeMap).getByText("Route map")).toBeInTheDocument();
    expect(
      within(routeMap).getByText("Default shows no places. Custom labels only the kinds of places you check.")
    ).toBeInTheDocument();
    expect(within(tracker).getByRole("radio", { name: "Default" })).toBeChecked();
    expect(within(routeMap).getByRole("radio", { name: "Default" })).toBeChecked();
    expect(within(field).queryByRole("checkbox")).toBeNull();
  });

  it("writes the tracker's checked kinds with routeMap absent", async () => {
    const { tracker } = await renderPage();
    fireEvent.click(within(tracker).getByRole("radio", { name: "Custom" }));
    const boxes = within(within(tracker).getByTestId("pois-categories")).getAllByRole("checkbox");
    expect(boxes.map((b) => b.closest("label")?.textContent)).toEqual([
      "Attractions",
      "Businesses and shops",
      "Government",
      "Medical",
      "Parks",
      "Churches",
      "Schools",
      "Sports",
      "Transit",
    ]);
    fireEvent.click(within(tracker).getByRole("checkbox", { name: "Schools" }));
    fireEvent.click(within(tracker).getByRole("checkbox", { name: "Parks" }));
    const doc = await save();
    expect(doc.places).toEqual({ tracker: { kinds: ["park", "school"] } });
  });

  it("writes an empty route map list for Custom with nothing checked and shows the caption", async () => {
    const { routeMap } = await renderPage();
    fireEvent.click(within(routeMap).getByRole("radio", { name: "Custom" }));
    expect(within(routeMap).getByRole("checkbox", { name: "Groceries and stores" })).toBeInTheDocument();
    expect(within(routeMap).getByText("Nothing checked: the map shows no places.")).toBeInTheDocument();
    const doc = await save();
    expect(doc.places).toEqual({ routeMap: { kinds: [] } });
  });

  it("writes no places key once both groups are back on Default", async () => {
    const { tracker, routeMap } = await renderPage({
      tracker: { kinds: ["transit"] },
      routeMap: { kinds: kindsFor(["schools"]) },
    });
    fireEvent.click(within(tracker).getByRole("radio", { name: "Default" }));
    fireEvent.click(within(routeMap).getByRole("radio", { name: "Default" }));
    const doc = await save();
    expect(doc).not.toHaveProperty("places");
  });

  it("shows a stored places value with each category checked", async () => {
    const { tracker, routeMap } = await renderPage({
      tracker: { kinds: ["medical", "transit"] },
      routeMap: { kinds: kindsFor(["churches", "hotels"]) },
    });
    expect(within(tracker).getByRole("radio", { name: "Custom" })).toBeChecked();
    expect(within(tracker).getByRole("checkbox", { name: "Medical" })).toBeChecked();
    expect(within(tracker).getByRole("checkbox", { name: "Transit" })).toBeChecked();
    expect(within(tracker).getByRole("checkbox", { name: "Parks" })).not.toBeChecked();
    expect(within(routeMap).getByRole("radio", { name: "Custom" })).toBeChecked();
    expect(within(routeMap).getByRole("checkbox", { name: "Churches" })).toBeChecked();
    expect(within(routeMap).getByRole("checkbox", { name: "Hotels" })).toBeChecked();
    expect(within(routeMap).getByRole("checkbox", { name: "Health" })).not.toBeChecked();
  });
});
