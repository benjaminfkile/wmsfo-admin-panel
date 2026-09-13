// admin.md 6.25 and 9.2 Scan: unattached tag opens the AttachSheet with
// the New place step and the pin step; attached tag shows the current
// place with Move and Done; the reader is faked so jsdom does not open
// the camera.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

// Stub the Places JS loader. AttachSheet only needs an Autocomplete
// constructor that swallows its listener; jsdom cannot host Google
// Maps for real.
vi.mock("../places/googleMaps", () => {
  class FakeAutocomplete {
    constructor(_el: HTMLElement, _opts: object) {}
    bindTo() {}
    addListener() {}
    getPlace() {
      return { geometry: undefined };
    }
  }
  return {
    loadMaps: async () => ({ Map: class {} }),
    loadMarkers: async () => ({ Marker: class {} }),
    loadPlaces: async () => ({ Autocomplete: FakeAutocomplete }),
  };
});

import Scan from "./Scan";
import type { CodeReader, CodeReaderFactory } from "./barcodeReader";
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

// A fake reader that lets the test push a decoded value into the page.
function makeFakeReaderFactory(): {
  factory: CodeReaderFactory;
  read: (text: string) => void;
} {
  let onRead: ((text: string) => void) | null = null;
  const reader: CodeReader = {
    async start(_video, cb) {
      onRead = cb;
    },
    stop() {
      onRead = null;
    },
  };
  return {
    factory: () => reader,
    read: (text) => onRead?.(text),
  };
}

function Harness({ children }: { children: React.ReactNode }) {
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
              <MemoryRouter initialEntries={["/scan"]}>{children}</MemoryRouter>
            </QueryClientProvider>
          </NotifyProvider>
        </AuthProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  userManager = makeFakeUserManager(
    makeUser({ email: "canvasser@example.com", "cognito:groups": ["canvasser"] }),
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

describe("Scan (admin.md 6.25)", () => {
  it("an unattached tag opens AttachSheet; New place + phone pin runs three calls", async () => {
    const createBodies: unknown[] = [];
    const attachBodies: unknown[] = [];
    const pinBodies: unknown[] = [];
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/places`,
        async ({ request }) => {
          createBodies.push(await request.json());
          return HttpResponse.json(
            {
              id: 999,
              parentId: null,
              name: "Farmers' market",
              description: "",
              path: ["Farmers' market"],
              opensPageId: null,
              forwardUrl: null,
              opens: { kind: "home" },
              opensSource: "home",
              location: null,
              pin: null,
              codes: [],
              scans: { people: 0 },
              createdBy: "canvasser@example.com",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              audit: null,
            },
            { status: 201 },
          );
        },
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/qr-codes/:id/attach`,
        async ({ request, params }) => {
          attachBodies.push({
            id: Number(params.id),
            body: await request.json(),
          });
          return HttpResponse.json({
            id: Number(params.id),
            tag: "qr-002",
            attachment: {
              id: 900,
              placeId: 999,
              placePath: ["Farmers' market"],
              since: new Date().toISOString(),
            },
          });
        },
      ),
      http.put(
        `${testConfig.apiBaseUrl}/admin/places/:id/location`,
        async ({ request, params }) => {
          pinBodies.push({
            id: Number(params.id),
            body: await request.json(),
          });
          return HttpResponse.json({ id: Number(params.id) });
        },
      ),
    );

    // Fake Geolocation with a 12 m fix.
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

    const { factory, read } = makeFakeReaderFactory();
    const user = userEvent.setup();
    render(
      <Harness>
        <Scan readerFactory={factory} />
      </Harness>,
    );

    // Wait for the two initial queries to resolve.
    await screen.findByText(/2 codes known/i);

    // Push an unattached tag through the fake detector; the sheet
    // opens with the Attach step.
    act(() => read("https://site.test/q/qr-002"));
    const sheet = await screen.findByRole("presentation");
    await within(sheet).findByRole("heading", { name: /attach qr-002/i });

    // Take the "New place" inline path: type a name and Attach.
    const nameInput = within(sheet).getByLabelText(/new place name/i);
    await user.type(nameInput, "Farmers' market");
    await user.click(within(sheet).getByRole("button", { name: /^attach$/i }));

    // Two calls fire in order: create place, then attach.
    await waitFor(() => expect(createBodies).toHaveLength(1));
    expect(createBodies[0]).toMatchObject({
      name: "Farmers' market",
      parentId: null,
    });
    await waitFor(() => expect(attachBodies).toHaveLength(1));
    expect(attachBodies[0]).toMatchObject({
      id: 101,
      body: { placeId: 999 },
    });

    // Now the sheet flips to the pin step for the created place.
    await within(sheet).findByRole("heading", {
      name: /pin farmers' market/i,
    });
    await user.click(within(sheet).getByRole("button", { name: /use my location/i }));
    const pinBtn = await within(sheet).findByRole("button", {
      name: /pin here/i,
    });
    await user.click(pinBtn);

    await waitFor(() => expect(pinBodies).toHaveLength(1));
    expect(pinBodies[0]).toMatchObject({
      id: 999,
      body: { source: "phone", lat: 46.916, lng: -114.039, accuracyM: 12 },
    });
  });

  it("an attached tag lands on the attached-code view with Move and Done", async () => {
    const { factory, read } = makeFakeReaderFactory();
    const user = userEvent.setup();
    render(
      <Harness>
        <Scan readerFactory={factory} />
      </Harness>,
    );
    await screen.findByText(/2 codes known/i);

    // qr-001 is attached to Southgate Mall in the fixture.
    act(() => read("qr-001"));
    await screen.findByText(/qr-001 → southgate mall/i);
    expect(screen.getByRole("button", { name: /^move$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^done$/i })).toBeInTheDocument();

    // Move opens the AttachSheet with the current place preselected.
    await user.click(screen.getByRole("button", { name: /^move$/i }));
    const sheet = await screen.findByRole("presentation");
    await within(sheet).findByRole("heading", { name: /move qr-001/i });
  });

  it("manual tag entry opens the same flow when the camera does not cooperate", async () => {
    const { factory } = makeFakeReaderFactory();
    const user = userEvent.setup();
    render(
      <Harness>
        <Scan readerFactory={factory} />
      </Harness>,
    );
    await screen.findByText(/2 codes known/i);

    const input = screen.getByRole("textbox", { name: /manual tag/i });
    await user.type(input, "qr-001");
    await user.click(screen.getByRole("button", { name: /open/i }));

    await screen.findByText(/qr-001 → southgate mall/i);
  });
});
