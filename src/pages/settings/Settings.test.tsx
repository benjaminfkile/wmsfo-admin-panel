import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import Settings from "./Settings";
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
import { SETTING_SPECS } from "../../validation/settings";

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
          <MemoryRouter initialEntries={["/settings"]}>
            <NotifyProvider>
              <Settings />
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
});

afterEach(() => {
  server.resetHandlers();
});

function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  return () => {
    if (original === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).matchMedia;
    } else {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: original,
      });
    }
  };
}

describe("Settings on compact", () => {
  it("renders a card per key with the value input and Save inside the card", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(<Harness />);
      const card = await screen.findByTestId("setting-row-poll_interval_ms");
      expect(within(card).getByRole("spinbutton")).toBeInTheDocument();
      expect(
        within(card).getByRole("button", { name: /^save$/i })
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
    } finally {
      restore();
    }
  });
});

describe("Settings", () => {
  it("renders every setting from the fixture", async () => {
    render(<Harness />);
    for (const s of f.settings) {
      await screen.findByTestId(`setting-row-${s.key}`);
    }
  });

  it("PUTs { value: <number> } to /admin/settings/{key}", async () => {
    const user = userEvent.setup();
    const captured: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/settings/:key`,
        async ({ request }) => {
          const body = await request.json();
          captured.push({ url: request.url, body });
          return HttpResponse.json({
            ...f.settings[0],
            value: 30000,
          });
        }
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId("setting-row-poll_interval_ms");
    const input = within(row).getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "30000");
    await user.click(within(row).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]?.url).toMatch(/\/admin\/settings\/poll_interval_ms$/);
    expect(captured[0]?.body).toEqual({ value: 30000 });
  });

  it("rejects out-of-range values without calling the API", async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/settings/:key`,
        ({ request }) => {
          requests.push(request.url);
          return HttpResponse.json(f.settings[0]);
        }
      )
    );
    render(<Harness />);
    // poll_interval_ms range is 1000 to 60000.
    const row = await screen.findByTestId("setting-row-poll_interval_ms");
    const input = within(row).getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "999");
    await user.click(within(row).getByRole("button", { name: /^save$/i }));
    expect(
      await within(row).findByText(
        /Must be a whole number between 1000 and 60000/i
      )
    ).toBeInTheDocument();
    expect(requests.length).toBe(0);
  });

  it("has a spec for every documented key", () => {
    // 6.9 lists nine keys in a specific order; SETTING_SPECS is that order.
    expect(SETTING_SPECS.map((s) => s.key)).toEqual([
      "poll_interval_ms",
      "cookie_limit_per_person",
      "sponsor_linger_ms_per_dollar",
      "sponsor_linger_min_ms",
      "beacon_stale_after_s",
      "flight_history_max_points",
      "location_min_interval_ms",
      "location_min_distance_m",
      "location_max_gap_s",
    ]);
  });

  it("renders the flight_history_max_points row from the fixture", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(
      "setting-row-flight_history_max_points"
    );
    expect(row).toBeInTheDocument();
  });

  it("renders the three location keys with their help lines", async () => {
    render(<Harness />);
    const iv = await screen.findByTestId("setting-row-location_min_interval_ms");
    expect(
      within(iv).getByText(/least time between two accepted fixes/i)
    ).toBeInTheDocument();
    const dist = await screen.findByTestId(
      "setting-row-location_min_distance_m"
    );
    expect(
      within(dist).getByText(/shown live but not recorded/i)
    ).toBeInTheDocument();
    const gap = await screen.findByTestId("setting-row-location_max_gap_s");
    expect(
      within(gap).getByText(/recorded regardless once this long has passed/i)
    ).toBeInTheDocument();
  });

  it("rejects out-of-range values for the three location keys and PUTs an in-range one", async () => {
    const user = userEvent.setup();
    const captured: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/settings/:key`,
        async ({ params, request }) => {
          const body = await request.json();
          captured.push({ url: request.url, body });
          return HttpResponse.json({
            key: String(params.key),
            value: 500,
            updatedBy: "admin@example.com",
            updatedAt: "2026-12-22T02:00:00.000Z",
          });
        }
      )
    );
    render(<Harness />);
    // location_min_interval_ms: rejects a value above 60000.
    const row = await screen.findByTestId(
      "setting-row-location_min_interval_ms"
    );
    const input = within(row).getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "70000");
    await user.click(within(row).getByRole("button", { name: /^save$/i }));
    expect(
      await within(row).findByText(/between 0 and 60000/i)
    ).toBeInTheDocument();
    expect(captured.length).toBe(0);

    // A valid value fires the PUT.
    await user.clear(input);
    await user.type(input, "500");
    await user.click(within(row).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]?.url).toMatch(
      /\/admin\/settings\/location_min_interval_ms$/
    );
    expect(captured[0]?.body).toEqual({ value: 500 });
  });
});
