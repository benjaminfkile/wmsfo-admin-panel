// admin.md 6.24 and 9.2 place detail: the pin write carries its
// `source`, "Use my location" refuses fixes worse than 500 m, and the
// Maps loader is stubbed so jsdom does not hit the real API.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

// Stub the Maps loader. The place detail only needs the loader to
// return something newable for Map, Marker, and Autocomplete; jsdom
// cannot host the real Maps JS API.
vi.mock("./googleMaps", () => {
  const listeners = new WeakMap<object, Record<string, Array<() => void>>>();
  const on = (obj: object, event: string, fn: () => void) => {
    const bag = listeners.get(obj) ?? {};
    bag[event] = [...(bag[event] ?? []), fn];
    listeners.set(obj, bag);
  };

  class FakeMap {
    constructor(_div: HTMLElement, _opts: object) {}
    panTo() {}
    fitBounds() {}
  }
  class FakeMarker {
    private pos: { lat: number; lng: number };
    private draggable: boolean;
    constructor(opts: { position: { lat: number; lng: number }; draggable?: boolean }) {
      this.pos = opts.position;
      this.draggable = !!opts.draggable;
    }
    setPosition(p: { lat: number; lng: number }) {
      this.pos = p;
    }
    setDraggable(v: boolean) {
      this.draggable = v;
    }
    setMap() {}
    getPosition() {
      return {
        lat: () => this.pos.lat,
        lng: () => this.pos.lng,
      };
    }
    addListener(event: string, fn: () => void) {
      on(this as unknown as object, event, fn);
    }
  }
  class FakeAutocomplete {
    constructor(_el: HTMLElement, _opts: object) {}
    bindTo() {}
    addListener() {}
    getPlace() {
      return { geometry: undefined };
    }
  }

  return {
    loadMaps: async () => ({ Map: FakeMap }),
    loadMarkers: async () => ({ Marker: FakeMarker }),
    loadPlaces: async () => ({ Autocomplete: FakeAutocomplete }),
  };
});

import PlaceDetail from "./PlaceDetail";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { NotifyProvider } from "../../hooks/useNotify";
import AuthProvider from "../../auth/AuthProvider";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import type { UserManager } from "oidc-client-ts";

let userManager: UserManager;

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
        <AuthProvider userManager={userManager}>
          <NotifyProvider>
            <QueryClientProvider client={client}>
              <MemoryRouter initialEntries={["/places/1"]}>
                <Routes>
                  <Route path="/places/:id" element={<PlaceDetail />} />
                </Routes>
              </MemoryRouter>
            </QueryClientProvider>
          </NotifyProvider>
        </AuthProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  userManager = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] }),
  );
  installClient({
    config: testConfig,
    userManager,
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  server.resetHandlers();
});

describe("PlaceDetail (admin.md 6.24)", () => {
  it("Use my location writes the pin with source phone when accuracy is within 500 m", async () => {
    const seen: Array<Record<string, unknown>> = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/places/:id/location`,
        async ({ request }) => {
          seen.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({
            id: 1,
            parentId: null,
            name: "Southgate Mall",
            description: "Main level",
            path: ["Southgate Mall"],
            opensPageId: null,
            forwardUrl: null,
            opens: { kind: "home" },
            opensSource: "home",
            location: {
              lat: 46.916,
              lng: -114.039,
              accuracyM: 12,
              source: "phone",
              pinnedBy: "person:admin@example.com",
              pinnedAt: new Date().toISOString(),
            },
            pin: { lat: 46.916, lng: -114.039, fromPlaceId: 1 },
            codes: [{ id: 100, tag: "qr-001" }],
            scans: { people: 4 },
            createdBy: "admin@example.com",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            audit: null,
          });
        },
      ),
    );

    // Fake Geolocation with a 12 m accuracy fix.
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          onOk: (pos: GeolocationPosition) => void,
        ) => {
          onOk({
            coords: {
              latitude: 46.916,
              longitude: -114.039,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            } as GeolocationCoordinates,
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });

    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("heading", { name: /place:/i });

    await user.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.source).toBe("phone");
    expect(seen[0]?.accuracyM).toBe(12);
    expect(seen[0]?.lat).toBe(46.916);
    expect(seen[0]?.lng).toBe(-114.039);
  });

  it("Use my location refuses a fix worse than 500 m", async () => {
    // The API should not be called.
    let calls = 0;
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/places/:id/location`,
        () => {
          calls += 1;
          return HttpResponse.json({});
        },
      ),
    );

    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (onOk: (pos: GeolocationPosition) => void) => {
          onOk({
            coords: {
              latitude: 46.916,
              longitude: -114.039,
              accuracy: 720,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            } as GeolocationCoordinates,
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });

    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("heading", { name: /place:/i });

    await user.click(screen.getByRole("button", { name: /use my location/i }));
    await screen.findByText(/worse than 500 m/i);
    expect(calls).toBe(0);
  });

  it("Use the parent's pin deletes the own location", async () => {
    // First put the parent (id 1) with an own pin, then load its
    // child (id 2), which should show "Use the parent's pin" enabled
    // and DELETE the child's location on click.
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/places`, () =>
        HttpResponse.json({
          items: [
            {
              id: 1,
              parentId: null,
              name: "Southgate Mall",
              description: "",
              path: ["Southgate Mall"],
              opensPageId: null,
              forwardUrl: null,
              opens: { kind: "home" },
              opensSource: "home",
              location: {
                lat: 46.916,
                lng: -114.039,
                accuracyM: 12,
                source: "phone",
                pinnedBy: "person:admin@example.com",
                pinnedAt: new Date().toISOString(),
              },
              pin: { lat: 46.916, lng: -114.039, fromPlaceId: 1 },
              codes: [],
              scans: { people: 0 },
              createdBy: "admin@example.com",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              audit: null,
            },
            {
              id: 2,
              parentId: 1,
              name: "West wing",
              description: "",
              path: ["Southgate Mall", "West wing"],
              opensPageId: null,
              forwardUrl: null,
              opens: { kind: "home" },
              opensSource: "home",
              location: {
                lat: 46.9,
                lng: -114.0,
                accuracyM: 10,
                source: "drag",
                pinnedBy: "person:admin@example.com",
                pinnedAt: new Date().toISOString(),
              },
              pin: { lat: 46.9, lng: -114.0, fromPlaceId: 2 },
              codes: [],
              scans: { people: 0 },
              createdBy: "admin@example.com",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              audit: null,
            },
          ],
        }),
      ),
    );
    let deleted = 0;
    server.use(
      http.delete(
        `${testConfig.apiBaseUrl}/admin/places/:id/location`,
        () => {
          deleted += 1;
          return HttpResponse.json({});
        },
      ),
    );

    const user = userEvent.setup();
    render(
      <ThemeProvider theme={buildTheme("light")}>
        <CssBaseline />
        <ConfigProvider config={testConfig}>
          <AuthProvider userManager={userManager}>
            <NotifyProvider>
              <QueryClientProvider
                client={
                  new QueryClient({
                    defaultOptions: {
                      queries: { retry: false, staleTime: 0, gcTime: 0 },
                      mutations: { retry: false },
                    },
                  })
                }
              >
                <MemoryRouter initialEntries={["/places/2"]}>
                  <Routes>
                    <Route path="/places/:id" element={<PlaceDetail />} />
                  </Routes>
                </MemoryRouter>
              </QueryClientProvider>
            </NotifyProvider>
          </AuthProvider>
        </ConfigProvider>
      </ThemeProvider>,
    );

    await screen.findByRole("heading", { name: /place: west wing/i });
    const btn = screen.getByRole("button", { name: /use the parent's pin/i });
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    await waitFor(() => expect(deleted).toBe(1));
  });
});
