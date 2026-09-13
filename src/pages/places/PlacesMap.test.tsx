// admin.md 6.24 map page and admin.md 9.2: pins are sized by their
// people count and the side list renders one row per pin; the Maps
// loader is stubbed so jsdom does not hit the real API.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("./googleMaps", () => {
  class FakeMap {
    constructor(_div: HTMLElement, _opts: object) {}
    fitBounds() {}
  }
  const created: Array<{ scale: number; text: string }> = [];
  class FakeMarker {
    constructor(opts: {
      icon?: { scale?: number };
      label?: { text?: string };
    }) {
      created.push({
        scale: opts.icon?.scale ?? 0,
        text: opts.label?.text ?? "",
      });
    }
    setMap() {}
  }
  return {
    loadMaps: async () => ({ Map: FakeMap }),
    loadMarkers: async () => ({ Marker: FakeMarker }),
    loadPlaces: async () => ({ Autocomplete: class {} }),
    __markers: created,
  };
});

import PlacesMap, { circleSizeFor } from "./PlacesMap";
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

// jsdom does not implement google.maps.LatLngBounds; the map effect
// calls it once when there are pins. Provide the minimum shape the code
// touches.
Object.defineProperty(globalThis, "google", {
  configurable: true,
  value: {
    maps: {
      LatLngBounds: class {
        private items: unknown[] = [];
        extend(p: unknown) {
          this.items.push(p);
        }
        isEmpty() {
          return this.items.length === 0;
        }
      },
      SymbolPath: { CIRCLE: 0 },
    },
  },
});

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
              <MemoryRouter initialEntries={["/places/map"]}>
                <Routes>
                  <Route path="/places/map" element={<PlacesMap />} />
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

describe("circleSizeFor (admin.md 6.24)", () => {
  it("grows with the people count", () => {
    const a = circleSizeFor(1, 100);
    const b = circleSizeFor(25, 100);
    const c = circleSizeFor(100, 100);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});

describe("PlacesMap (admin.md 6.24)", () => {
  it("renders the side list and the unpinned and unattached counts", async () => {
    render(<Harness />);
    await screen.findByRole("heading", { name: /places map/i });
    // The side list picks up the pin from the fixtures.
    await screen.findByTestId("places-map-list");
    expect(screen.getByText(/Southgate Mall/i)).toBeInTheDocument();
    // Counts from the MSW handler.
    expect(screen.getByText(/Unpinned places with scans: 1/)).toBeInTheDocument();
    expect(
      screen.getByText(/Unattached codes with scans: 2/),
    ).toBeInTheDocument();
  });
});
