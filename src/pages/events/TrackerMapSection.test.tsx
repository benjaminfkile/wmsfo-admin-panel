import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import TrackerMapSection from "./TrackerMapSection";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import type { Event, TrackerMap } from "../../api/types";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

vi.setConfig({ testTimeout: 20_000 });

// The box editor's map: created over the dev basemap, never loaded here.
const created: Record<string, unknown>[] = [];
vi.mock("maplibre-gl", () => {
  class Map {
    constructor(opts: Record<string, unknown>) {
      created.push(opts);
    }
    on() {
      return this;
    }
    remove() {
      return undefined;
    }
  }
  return { Map, Marker: class {}, addProtocol: () => undefined, setWorkerUrl: () => undefined };
});

vi.mock("pmtiles", () => ({
  Protocol: class {
    tile = () => undefined;
  },
  PMTiles: class {},
}));

const BOX = { west: -114.3, south: 46.75, east: -113.8, north: 47.05 };
const SITE_BOX = { west: -114.2, south: 46.8, east: -113.9, north: 47.0 };

// A ready map far from the box, beside the seeded valley map and the
// pending package of the fixtures.
const FLATHEAD: TrackerMap = {
  ...f.trackerMaps[0]!,
  id: 3,
  name: "Flathead",
  prefix: "maps/3",
  bbox: { west: -114.6, south: 47.7, east: -113.9, north: 48.4 },
  terrainUrl: null,
  terrainBytes: null,
  terrainMaxZoom: null,
};

function makeEvent(over: Partial<Event> = {}): Event {
  return {
    ...f.events[0]!,
    trackerBbox: BOX,
    trackerMapId: 1,
    trackerThemeIds: [1, 2, 3],
    ...over,
  };
}

function Harness({ event }: { event: Event }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ConfigProvider config={testConfig}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <NotifyProvider>
              <TrackerMapSection event={event} />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  created.length = 0;
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/maps`, () =>
      HttpResponse.json({ items: [f.trackerMaps[0], FLATHEAD, f.trackerMaps[1]] })
    ),
    http.get(`${testConfig.apiBaseUrl}/admin/themes`, () =>
      HttpResponse.json({
        items: f.trackerThemes.map((t) =>
          t.id === 3 ? { ...t, thumbnailMediaId: f.mediaAssets[0]!.id } : t
        ),
      })
    ),
    http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
      HttpResponse.json({
        ...f.siteSettingsDraft,
        data: { ...(f.siteSettingsDraft.data as Record<string, unknown>), tracker: { defaultBbox: SITE_BOX } },
      })
    )
  );
});

function field(side: string): HTMLInputElement {
  return screen.getByTestId(`bbox-${side}`) as HTMLInputElement;
}

async function renderCard(event: Event = makeEvent()) {
  render(<Harness event={event} />);
  const card = await screen.findByTestId("tracker-map-card");
  await within(card).findByRole("checkbox", { name: "Standard" });
  if (event.trackerMapId != null) {
    await waitFor(() =>
      expect(within(card).getByRole("combobox")).toHaveTextContent("Missoula valley")
    );
  }
  return card;
}

describe("TrackerMapSection", () => {
  it("shows the event's box, map, and themes with the help keys", async () => {
    const card = await renderCard();
    expect(within(card).getByText("Tracker map")).toBeInTheDocument();
    for (const key of [
      "events.detail.tracker-map",
      "events.detail.tracker-map.bbox",
      "events.detail.tracker-map.map",
      "events.detail.tracker-map.themes",
    ]) {
      expect(within(card).getByTestId(`help-${key}`)).toBeInTheDocument();
    }
    expect(field("west").value).toBe("-114.3000");
    expect(field("south").value).toBe("46.7500");
    expect(field("east").value).toBe("-113.8000");
    expect(field("north").value).toBe("47.0500");
    expect(within(card).getByTestId("bbox-min-zoom")).toHaveTextContent(/^Minimum zoom: .+ on a phone, .+ on a desktop$/);
    // The editor's map is drawn over the dev basemap.
    await waitFor(() => expect(created).toHaveLength(1));
    const style = created[0]!.style as { sources: Record<string, { url?: string }> };
    expect(style.sources.basemap?.url).toBe("pmtiles://https://basemap.test/tiles.pmtiles");

    expect(within(card).getByRole("checkbox", { name: "Route light" })).toBeChecked();
    expect(within(card).getByRole("checkbox", { name: "Route dark" })).toBeChecked();
    expect(within(card).getByRole("checkbox", { name: "Standard" })).toBeChecked();
    expect(within(card).getByRole("checkbox", { name: "Night" })).not.toBeChecked();
    expect(within(card).getByTestId("tracker-map-note")).toHaveTextContent(
      "Viewers whose browser can draw this map get it; the rest get Google Maps, locked to the box"
    );
    expect(within(card).getByTestId("tracker-map-save")).toBeDisabled();
  });

  it("lists the ready maps that contain the box, the others disabled, and no pending map", async () => {
    const user = userEvent.setup();
    const card = await renderCard();
    await user.click(within(card).getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "No map",
      "Flatheaddoes not cover the box",
      "Missoula valleyWith terrain",
    ]);
    expect(within(listbox).getByRole("option", { name: /Flathead/ })).toHaveAttribute("aria-disabled", "true");
    expect(within(listbox).getByRole("option", { name: /Missoula valley/ })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(within(listbox).queryByRole("option", { name: /Bitterroot/ })).toBeNull();

    await user.click(within(listbox).getByRole("option", { name: "No map" }));
    expect(within(card).getByTestId("tracker-map-note")).toHaveTextContent(
      "No map: every viewer gets Google Maps, locked to the box"
    );
  });

  it("groups the themes with thumbnails, swatches, and the default badges", async () => {
    const card = await renderCard();
    const google = within(card).getByTestId("tracker-themes-google");
    const maplibre = within(card).getByTestId("tracker-themes-maplibre");
    expect(within(google).getByText("Google Maps")).toBeInTheDocument();
    expect(within(maplibre).getByText("MapLibre")).toBeInTheDocument();
    expect(within(google).getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual([
      "Standard",
      "Expedition",
      "Blizzard",
      "Charcoal",
      "Night",
      "Nebula",
    ]);
    expect(within(maplibre).getAllByRole("checkbox")).toHaveLength(2);
    const thumb = await within(google).findByTestId("theme-thumb-3");
    expect(thumb).toHaveAttribute("src", "https://cdn.example/media/8c1d5e2a/w480.webp");
    expect(within(google).getByTestId("theme-swatch-4")).toBeInTheDocument();
    expect(within(maplibre).getByTestId("theme-swatch-1")).toBeInTheDocument();
    expect(within(google).getAllByText("Light default")).toHaveLength(1);
    expect(within(google).getAllByText("Dark default")).toHaveLength(1);
    expect(within(maplibre).getByText("Light default")).toBeInTheDocument();
    expect(within(maplibre).getByText("Dark default")).toBeInTheDocument();
  });

  it("disables Save until a Google theme is enabled", async () => {
    const user = userEvent.setup();
    const card = await renderCard();
    await user.click(within(card).getByRole("checkbox", { name: "Standard" }));
    expect(within(card).getByText("Enable at least one Google theme")).toBeInTheDocument();
    expect(within(card).getByTestId("tracker-map-save")).toBeDisabled();
    await user.click(within(card).getByRole("checkbox", { name: "Night" }));
    expect(within(card).queryByText("Enable at least one Google theme")).toBeNull();
    expect(within(card).getByTestId("tracker-map-save")).toBeEnabled();
  });

  it("Use site default puts the draft's box back", async () => {
    const user = userEvent.setup();
    const card = await renderCard();
    await user.click(within(card).getByRole("button", { name: "Use site default" }));
    expect(field("west").value).toBe("-114.2000");
    expect(field("south").value).toBe("46.8000");
    expect(field("east").value).toBe("-113.9000");
    expect(field("north").value).toBe("47.0000");
    expect(within(card).getByTestId("tracker-map-save")).toBeEnabled();
  });

  it("moving the box past the chosen map shows the message and disables that map", async () => {
    const user = userEvent.setup();
    const card = await renderCard();
    fireEvent.change(field("west"), { target: { value: "-115" } });
    expect(within(card).getByTestId("tracker-map-uncovered")).toHaveTextContent(
      "The map Missoula valley does not cover this area. Choose another map or widen the area."
    );
    expect(within(card).getByTestId("tracker-map-save")).toBeDisabled();
    await user.click(within(card).getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: /Missoula valley/ })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await user.click(within(listbox).getByRole("option", { name: "No map" }));
    expect(within(card).queryByTestId("tracker-map-uncovered")).toBeNull();
    expect(within(card).getByTestId("tracker-map-save")).toBeEnabled();
  });

  it("Save sends only the changed fields and toasts", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(makeEvent({ trackerThemeIds: [1, 3] }));
      })
    );
    const card = await renderCard();
    await user.click(within(card).getByRole("checkbox", { name: "Route dark" }));
    await user.click(within(card).getByTestId("tracker-map-save"));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ trackerThemeIds: [1, 3] });
    expect(await screen.findByText("Tracker map saved")).toBeInTheDocument();
  });

  it("Save sends a moved box and a cleared map without the themes", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(makeEvent());
      })
    );
    const card = await renderCard();
    fireEvent.change(field("north"), { target: { value: "47.1" } });
    await user.click(within(card).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "No map" }));
    await user.click(within(card).getByTestId("tracker-map-save"));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      trackerBbox: { ...BOX, north: 47.1 },
      trackerMapId: null,
    });
  });

  it("a 400 at trackerMapId lands on the map select", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json(
          {
            code: "validation_failed",
            message: "Validation failed",
            details: { fields: { "/trackerMapId": "The map is not ready" } },
            requestId: "req-1",
          },
          { status: 400 }
        )
      )
    );
    const card = await renderCard(makeEvent({ trackerMapId: null }));
    await user.click(within(card).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Missoula valley/ }));
    await user.click(within(card).getByTestId("tracker-map-save"));
    expect(await within(card).findByText("The map is not ready")).toBeInTheDocument();
  });
});
