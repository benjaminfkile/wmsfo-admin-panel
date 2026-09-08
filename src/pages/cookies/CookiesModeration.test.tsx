import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import CookiesModeration from "./CookiesModeration";
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

function Harness({ initialUrl = "/cookies" }: { initialUrl?: string }) {
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
          <MemoryRouter initialEntries={[initialUrl]}>
            <NotifyProvider>
              <CookiesModeration />
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

describe("CookiesModeration", () => {
  it("preselects the current event", async () => {
    render(<Harness />);
    // The fixture events include event 7 as isCurrent.
    // The event selector should reflect it.
    await screen.findByTestId(`cookie-row-${f.cookies[0]!.id}`);
    const combo = screen.getByRole("combobox", { name: /event/i });
    // The event with isCurrent has id 7 and name "Santa Flyover 2026".
    expect(combo).toHaveTextContent(f.events[0]!.name!);
  });

  it("preselects the event from ?eventId=", async () => {
    render(<Harness initialUrl={`/cookies?eventId=${f.events[1]!.id}`} />);
    await screen.findByTestId(`cookie-row-${f.cookies[0]!.id}`);
    const combo = screen.getByRole("combobox", { name: /event/i });
    expect(combo).toHaveTextContent(f.events[1]!.name!);
  });

  it("hide replaces the row in place", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/cookies/:id/hide`,
        () =>
          HttpResponse.json({
            ...f.cookies[0],
            hiddenAt: "2026-12-22T02:00:00.000Z",
            hiddenBy: "admin@example.com",
          })
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId(`cookie-row-${f.cookies[0]!.id}`);
    expect(within(row).getByText("visible")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /hide/i }));
    await waitFor(() => {
      const updated = screen.getByTestId(`cookie-row-${f.cookies[0]!.id}`);
      expect(within(updated).queryByText("visible")).toBeNull();
      expect(within(updated).getByText(/hidden by/i)).toBeInTheDocument();
    });
  });

  it("unhide replaces the row in place", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        `${testConfig.apiBaseUrl}/admin/events/:id/cookies`,
        () =>
          HttpResponse.json({
            items: [
              {
                ...f.cookies[0],
                hiddenAt: "2026-12-22T02:00:00.000Z",
                hiddenBy: "admin@example.com",
              },
            ],
            nextCursor: null,
          })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/cookies/:id/unhide`,
        () =>
          HttpResponse.json({
            ...f.cookies[0],
            hiddenAt: null,
            hiddenBy: null,
          })
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId(`cookie-row-${f.cookies[0]!.id}`);
    expect(within(row).getByText(/hidden by/i)).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /unhide/i }));
    await waitFor(() => {
      const updated = screen.getByTestId(`cookie-row-${f.cookies[0]!.id}`);
      expect(within(updated).getByText("visible")).toBeInTheDocument();
    });
  });
});
