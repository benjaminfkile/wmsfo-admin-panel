import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { FakeMap, startViewMap } from "../../test/fakeGoogleMap";

vi.setConfig({ testTimeout: 20_000 });

// The box editor's and the start view's maps: Google maps on the Maps key.
vi.mock("../../pages/places/googleMaps", async () => {
  const { FakeMap: Map } = await import("../../test/fakeGoogleMap");
  class Overlay {
    setMap() {}
    setBounds() {}
    setPaths() {}
  }
  class Marker extends Overlay {
    setPosition() {}
    addListener() {
      return { remove: () => undefined };
    }
  }
  return {
    loadMaps: vi.fn(async () => ({ Map, Rectangle: Overlay, Polygon: Overlay })),
    loadMarkers: vi.fn(async () => ({ Marker })),
    loadPlaces: vi.fn(async () => ({})),
  };
});

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
  FakeMap.instances.length = 0;
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
    // The editor's map and the start view's are Google maps.
    await waitFor(() => expect(FakeMap.instances).toHaveLength(2));
    expect(FakeMap.instances.map((m) => m.opts)).toContainEqual(
      expect.objectContaining({ gestureHandling: "greedy" })
    );
    expect(within(card).getByTestId("help-events.detail.tracker-map.start-view")).toBeInTheDocument();

    expect(within(card).getByRole("checkbox", { name: "Light" })).toBeChecked();
    expect(within(card).getByRole("checkbox", { name: "Dark" })).toBeChecked();
    expect(within(card).getByRole("checkbox", { name: "Standard" })).toBeChecked();
    expect(within(card).getByRole("checkbox", { name: "Night" })).not.toBeChecked();
    expect(within(card).getByTestId("tracker-map-note")).toHaveTextContent(
      "Viewers whose browser can draw this map get it; the rest get Google Maps, locked to the box"
    );
    expect(within(card).getByTestId("tracker-map-save")).toBeDisabled();
  });

  it("lists No map and every ready map by name with its terrain word, and no pending map", async () => {
    const user = userEvent.setup();
    const card = await renderCard();
    await user.click(within(card).getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "No map",
      "FlatheadNo terrain",
      "Missoula valleyWith terrain",
    ]);
    for (const o of options) expect(o).not.toHaveAttribute("aria-disabled", "true");
    expect(within(listbox).queryByRole("option", { name: /Bitterroot/ })).toBeNull();

    await user.click(within(listbox).getByRole("option", { name: "No map" }));
    expect(within(card).getByTestId("tracker-map-note")).toHaveTextContent(
      "No map: every viewer gets Google Maps, locked to the box"
    );
  });

  it("reads terrain from the terrain archive, never the measured sizes", async () => {
    // Two ready maps covering the box: one without terrain, one with
    // terrain and no sizes on record.
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/maps`, () =>
        HttpResponse.json({
          items: [
            { ...f.trackerMaps[0]!, tilesBytes: null, terrainBytes: null },
            {
              ...f.trackerMaps[0]!,
              id: 5,
              name: "Rattlesnake",
              prefix: "maps/5",
              terrainMaxZoom: null,
              terrainUrl: null,
              terrainBytes: null,
              tilesBytes: 314572800,
            },
          ],
        })
      )
    );
    const user = userEvent.setup();
    const card = await renderCard();
    await user.click(within(card).getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "No map",
      "Missoula valleyWith terrain",
      "RattlesnakeNo terrain",
    ]);
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

  it("Use site default shows under No map only and puts the draft's box back", async () => {
    const user = userEvent.setup();
    const card = await renderCard();
    expect(within(card).queryByRole("button", { name: "Use site default" })).toBeNull();
    await user.click(within(card).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "No map" }));
    // No map keeps the box.
    expect(field("west").value).toBe("-114.3000");
    await user.click(within(card).getByRole("button", { name: "Use site default" }));
    expect(field("west").value).toBe("-114.2000");
    expect(field("south").value).toBe("46.8000");
    expect(field("east").value).toBe("-113.9000");
    expect(field("north").value).toBe("47.0000");
    expect(within(card).getByTestId("tracker-map-save")).toBeEnabled();
  });

  it("switching maps resets the box to the new map's area, and Save sends both", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(makeEvent());
      })
    );
    const card = await renderCard();
    await user.click(within(card).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Flathead/ }));
    expect(field("west").value).toBe("-114.6000");
    expect(field("south").value).toBe("47.7000");
    expect(field("east").value).toBe("-113.9000");
    expect(field("north").value).toBe("48.4000");
    await user.click(within(card).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Missoula valley/ }));
    expect(field("west").value).toBe("-114.7500");
    expect(field("north").value).toBe("47.2500");
    await user.click(within(card).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Flathead/ }));
    await user.click(within(card).getByTestId("tracker-map-save"));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ trackerBbox: FLATHEAD.bbox, trackerMapId: 3 });
  });

  it("keeps the box inside the chosen map: a side typed past its edge names the map and moves onto it", async () => {
    const card = await renderCard();
    fireEvent.change(field("west"), { target: { value: "-115" } });
    expect(within(card).getByTestId("bbox-outside")).toHaveTextContent(
      "The area must lie inside the area of the map Missoula valley"
    );
    fireEvent.blur(field("west"));
    expect(field("west").value).toBe("-114.7500");
    expect(within(card).queryByTestId("bbox-outside")).toBeNull();
    expect(within(card).queryByTestId("tracker-map-uncovered")).toBeNull();
  });

  it("a legacy row whose box lies outside its map shows the message, and the API's on save", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json(
          {
            code: "validation_failed",
            message: "Validation failed",
            details: { fields: { "/trackerBbox": "must lie inside the map's area" } },
            requestId: "req-2",
          },
          { status: 400 }
        )
      )
    );
    const outside = { west: -115.5, south: 46.75, east: -114.9, north: 47.05 };
    const card = await renderCard(makeEvent({ trackerBbox: outside }));
    expect(within(card).getByTestId("bbox-outside")).toBeInTheDocument();
    fireEvent.change(field("north"), { target: { value: "47.1" } });
    await user.click(within(card).getByTestId("tracker-map-save"));
    expect(await within(card).findByText("must lie inside the map's area")).toBeInTheDocument();
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
    await user.click(within(card).getByRole("checkbox", { name: "Dark" }));
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

  it("Save sends the start view set by moving the map", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(makeEvent());
      })
    );
    const card = await renderCard();
    expect(within(card).getByTestId("start-view-caption")).toHaveTextContent("Whole area");
    await waitFor(() => expect(startViewMap()?.options.restriction).toBeDefined());
    act(() => startViewMap()!.pan({ lat: 46.9, lng: -114.05 }, 12));
    await user.click(within(card).getByTestId("tracker-map-save"));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      trackerStartView: { center: { lat: 46.9, lng: -114.05 }, zoom: 12 },
    });
  });

  it("Use whole area sends null for a stored start view", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(makeEvent());
      })
    );
    const card = await renderCard(
      makeEvent({ trackerStartView: { center: { lat: 46.9, lng: -114 }, zoom: 11 } })
    );
    expect(within(card).getByTestId("start-view-caption")).toHaveTextContent(
      "Centre 46.90000, -114.00000 at zoom 11"
    );
    await user.click(within(card).getByRole("button", { name: "Use whole area" }));
    await user.click(within(card).getByTestId("tracker-map-save"));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ trackerStartView: null });
  });

  it("a box change that strands the start view moves it inside, says so, and saves both", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(makeEvent());
      })
    );
    const card = await renderCard(
      makeEvent({ trackerStartView: { center: { lat: 47, lng: -113.85 }, zoom: 11 } })
    );
    fireEvent.change(field("east"), { target: { value: "-114" } });
    expect(within(card).getByTestId("start-view-moved")).toHaveTextContent(
      "Start view moved inside the new area"
    );
    await user.click(within(card).getByTestId("tracker-map-save"));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      trackerBbox: { ...BOX, east: -114 },
      trackerStartView: { center: { lat: 47, lng: -114 }, zoom: 11 },
    });
  });

  it("a 400 at trackerStartView shows under the field", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json(
          {
            code: "validation_failed",
            message: "Validation failed",
            details: { fields: { "/trackerStartView": "must lie inside trackerBbox" } },
            requestId: "req-4",
          },
          { status: 400 }
        )
      )
    );
    const card = await renderCard();
    await waitFor(() => expect(startViewMap()?.options.restriction).toBeDefined());
    act(() => startViewMap()!.pan({ lat: 46.9, lng: -114.05 }, 12));
    await user.click(within(card).getByTestId("tracker-map-save"));
    expect(await within(card).findByTestId("start-view-error")).toHaveTextContent(
      "must lie inside trackerBbox"
    );
  });
});
