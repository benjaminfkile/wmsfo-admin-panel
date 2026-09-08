import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import EventsList from "./EventsList";
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
          <MemoryRouter initialEntries={["/events"]}>
            <NotifyProvider>
              <EventsList />
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

describe("EventsList rows", () => {
  it("renders one row per event with the name and status", async () => {
    render(<Harness />);
    // Wait for the first row.
    await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    for (const e of f.events) {
      const row = screen.getByTestId(`event-row-${e.id}`);
      expect(within(row).getByText(e.name!)).toBeInTheDocument();
      expect(within(row).getByText(String(e.year))).toBeInTheDocument();
    }
  });

  it("shows the Current chip on the current event and hides Set current", async () => {
    render(<Harness />);
    const currentRow = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    expect(within(currentRow).getByText("Current")).toBeInTheDocument();
    expect(
      within(currentRow).queryByRole("button", { name: /set current/i })
    ).toBeNull();
    const otherRow = screen.getByTestId(`event-row-${f.events[1]!.id}`);
    expect(
      within(otherRow).getByRole("button", { name: /set current/i })
    ).toBeInTheDocument();
  });

  it("shows the route name for the row, from the routes list", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    expect(within(row).getByText(f.routes[0]!.name!)).toBeInTheDocument();
  });

  it("clicking Delete opens a confirmation with the event name", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    const del = within(row).getByRole("button", { name: /delete/i });
    await user.click(del);
    expect(
      await screen.findByText(new RegExp(`delete ${f.events[0]!.name}`, "i"))
    ).toBeInTheDocument();
  });

  it("New event dialog shows the inherit preview naming the latest route", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const newBtn = await screen.findByRole("button", { name: /new event/i });
    await user.click(newBtn);
    await screen.findByText(/inherit the most recent route/i);
    // Latest route in fixtures is route 4 "2026 draft" from the 2026 event.
    expect(
      await screen.findByText(
        new RegExp(`will inherit ${f.routes[0]!.name}`, "i")
      )
    ).toBeInTheDocument();
  });

  it("Create with No route sends the correct body", async () => {
    const user = userEvent.setup();
    const captured: Array<{ inheritRoute: boolean; routeId: number | null }> = [];
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/events`, async ({ request }) => {
        const body = (await request.json()) as {
          inheritRoute: boolean;
          routeId: number | null;
        };
        captured.push(body);
        return HttpResponse.json(f.events[0], { status: 201 });
      })
    );
    render(<Harness />);
    const newBtn = await screen.findByRole("button", { name: /new event/i });
    await user.click(newBtn);

    // Enter name.
    const name = await screen.findByLabelText(/name/i);
    await user.clear(name);
    await user.type(name, "Test event");

    // Choose "No route".
    await user.click(screen.getByLabelText(/no route/i));
    // Submit.
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0];
    expect(body?.inheritRoute).toBe(false);
    expect(body?.routeId).toBeNull();
  });
});
