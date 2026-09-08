import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import CookieTypesList from "./CookieTypesList";
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
import type { Event } from "../../api/types";

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
          <MemoryRouter initialEntries={["/cookie-types"]}>
            <NotifyProvider>
              <CookieTypesList />
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

describe("CookieTypesList — locked while live", () => {
  it("shows the banner and disables controls when an event is live", async () => {
    render(<Harness />);
    // Fixture events include one with statusId=3.
    await waitFor(() =>
      expect(screen.getByText(/locked:/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/is live/i)).toBeInTheDocument();
    const newBtn = screen.getByTestId("cookie-type-new");
    expect(newBtn).toBeDisabled();
    // Edit buttons on rows are disabled too.
    const row = screen.getByTestId(
      `cookie-type-row-${f.cookieTypes[0]!.id}`
    );
    const editBtn = within(row).getByRole("button", { name: /edit/i });
    expect(editBtn).toBeDisabled();
  });

  it("shows the banner on 409 event_live", async () => {
    const user = userEvent.setup();
    // Override events to have none live so the banner is not shown initially.
    const noneLive: Event[] = f.events.map((e) => ({
      ...e,
      statusId: 4,
      isCurrent: false,
    }));
    server.use(
      http.get(
        `${testConfig.apiBaseUrl}/admin/events`,
        () => HttpResponse.json({ items: noneLive })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/cookie-types`,
        () =>
          HttpResponse.json(
            {
              code: "event_live",
              message: "event live",
              details: null,
              requestId: "req-x",
            },
            { status: 409 }
          )
      )
    );
    render(<Harness />);
    const newBtn = await screen.findByTestId("cookie-type-new");
    await waitFor(() => expect(newBtn).not.toBeDisabled());
    await user.click(newBtn);
    // Fill the form so submit passes local validation.
    await user.type(await screen.findByLabelText(/^name/i), "Molasses");
    // Icon must be set (validation says so); open picker.
    await user.click(screen.getByRole("button", { name: /^choose$/i }));
    const tile = await screen.findByTestId("icon-tile-cookie");
    await user.click(tile);
    // The picker's Choose confirms.
    const buttons = screen.getAllByRole("button", { name: /^choose$/i });
    await user.click(buttons[buttons.length - 1]!);
    // Submit.
    const save = await screen.findByRole("button", { name: /^save$/i });
    await user.click(save);
    // The banner appears after 409.
    await waitFor(() =>
      expect(screen.getByText(/locked:/i)).toBeInTheDocument()
    );
  });
});

describe("CookieTypesList — icon picker", () => {
  it("offers the library plus svg assets only (not raster)", async () => {
    const user = userEvent.setup();
    // Force no live event so the controls are enabled.
    server.use(
      http.get(
        `${testConfig.apiBaseUrl}/admin/events`,
        () =>
          HttpResponse.json({
            items: f.events.map((e) => ({
              ...e,
              statusId: 4,
              isCurrent: false,
            })),
          })
      ),
      // Track what the picker's SVG tab asks for.
      http.get(`${testConfig.apiBaseUrl}/admin/media`, ({ request }) => {
        const url = new URL(request.url);
        // The picker's svg tab forces kind=svg.
        expect(url.searchParams.get("kind")).toBe("svg");
        expect(url.searchParams.get("state")).toBe("ready");
        return HttpResponse.json({ items: [], nextCursor: null });
      })
    );
    render(<Harness />);
    const newBtn = await screen.findByTestId("cookie-type-new");
    await waitFor(() => expect(newBtn).not.toBeDisabled());
    await user.click(newBtn);
    await user.click(screen.getByRole("button", { name: /^choose$/i }));
    // Library tab first — the tile appears from the fixture icons.
    await screen.findByTestId("icon-tile-cookie");
    // Switch to SVG assets tab — the request is made and inspected above.
    await user.click(screen.getByRole("tab", { name: /svg assets/i }));
    // The upload tab exists for uploading a new SVG.
    expect(
      screen.getByRole("tab", { name: /upload svg/i })
    ).toBeInTheDocument();
  });
});
