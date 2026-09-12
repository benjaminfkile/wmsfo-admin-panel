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
    // 6.9 lists six keys in a specific order; SETTING_SPECS is that order.
    expect(SETTING_SPECS.map((s) => s.key)).toEqual([
      "poll_interval_ms",
      "cookie_limit_per_person",
      "sponsor_linger_ms_per_dollar",
      "sponsor_linger_min_ms",
      "beacon_stale_after_s",
      "flight_history_max_points",
    ]);
  });

  it("renders the flight_history_max_points row from the fixture", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(
      "setting-row-flight_history_max_points"
    );
    expect(row).toBeInTheDocument();
  });
});
