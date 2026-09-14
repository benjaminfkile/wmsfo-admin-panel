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
    const user = userEvent.setup();
    render(<Harness />);
    const currentRow = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    expect(within(currentRow).getByText("Current")).toBeInTheDocument();
    // Row menu on the current row has no Set current item.
    await user.click(
      within(currentRow).getByRole("button", { name: /actions for/i })
    );
    expect(
      screen.queryByRole("menuitem", { name: /set current/i })
    ).toBeNull();
    // Close and open the non-current row's menu.
    await user.keyboard("{Escape}");
    const otherRow = screen.getByTestId(`event-row-${f.events[1]!.id}`);
    await user.click(
      within(otherRow).getByRole("button", { name: /actions for/i })
    );
    expect(
      await screen.findByRole("menuitem", { name: /set current/i })
    ).toBeInTheDocument();
  });

  it("shows the route name for the row, from the routes list", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    expect(within(row).getByText(f.routes[0]!.name!)).toBeInTheDocument();
  });

  it("clicking Delete on a deletable event opens the impact dialog with its name", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // events[0] is the live current event: Delete is disabled with a
    // tooltip (admin.md 8.3). Open the non-current, non-live row instead.
    const otherRow = await screen.findByTestId(`event-row-${f.events[1]!.id}`);
    await user.click(
      within(otherRow).getByRole("button", { name: /actions for/i })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^delete$/i })
    );
    expect(
      await screen.findByRole("dialog", {
        name: new RegExp(`delete ${f.events[1]!.name}`, "i"),
      })
    ).toBeInTheDocument();
  });

  it("Delete on the live/current event is disabled with the tooltip sentence", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const currentRow = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    await user.click(
      within(currentRow).getByRole("button", { name: /actions for/i })
    );
    const item = await screen.findByRole("menuitem", { name: /^delete$/i });
    expect(item).toHaveAttribute("aria-disabled", "true");
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

  it("Clone opens the dialog with defaults (source year + 1, name with year replaced, all three flags on)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    await user.click(
      within(row).getByRole("button", { name: /actions for/i })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^clone$/i })
    );
    const dialog = await screen.findByRole("dialog", { name: /clone event/i });
    const yearField = within(dialog).getByLabelText(/^year$/i) as HTMLInputElement;
    expect(yearField.value).toBe(String(Number(f.events[0]!.year) + 1));
    const nameField = within(dialog).getByLabelText(/^name$/i) as HTMLInputElement;
    // 2026 -> 2027 in the source name.
    expect(nameField.value).toBe(
      String(f.events[0]!.name).replace(
        String(f.events[0]!.year),
        String(Number(f.events[0]!.year) + 1)
      )
    );
    for (const label of [
      /sponsors for the year/i,
      /flight history/i,
      /route poster/i,
    ]) {
      const cb = within(dialog).getByRole("checkbox", { name: label });
      expect(cb).toBeChecked();
    }
  });

  it("Clone POSTs /admin/events/{id}/clone with { year, name, copy } and navigates on success", async () => {
    const user = userEvent.setup();
    const posts: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/events/:id/clone`,
        async ({ request }) => {
          posts.push({ url: request.url, body: await request.json() });
          return HttpResponse.json(
            { ...f.events[0]!, id: 99, year: 2027 },
            { status: 201 }
          );
        }
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    await user.click(
      within(row).getByRole("button", { name: /actions for/i })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^clone$/i })
    );
    const dialog = await screen.findByRole("dialog", { name: /clone event/i });
    // Uncheck the poster flag so we can assert on partial copy.
    await user.click(
      within(dialog).getByRole("checkbox", { name: /route poster/i })
    );
    await user.click(within(dialog).getByRole("button", { name: /^clone$/i }));
    await waitFor(() => expect(posts.length).toBe(1));
    expect(posts[0]?.url).toMatch(
      new RegExp(`/admin/events/${f.events[0]!.id}/clone$`)
    );
    expect(posts[0]?.body).toMatchObject({
      year: Number(f.events[0]!.year) + 1,
      copy: { sponsors: true, route: true, poster: false },
    });
  });

  it("Clone marks the year field on 409 year_taken", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/events/:id/clone`, () =>
        HttpResponse.json(
          {
            code: "year_taken",
            message: "Year is taken",
            details: null,
            requestId: "req-y",
          },
          { status: 409 }
        )
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId(`event-row-${f.events[0]!.id}`);
    await user.click(
      within(row).getByRole("button", { name: /actions for/i })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^clone$/i })
    );
    const dialog = await screen.findByRole("dialog", { name: /clone event/i });
    await user.click(within(dialog).getByRole("button", { name: /^clone$/i }));
    // The year field carries the error helper text.
    await waitFor(() => {
      const yearInput = within(dialog).getByLabelText(/^year$/i);
      expect(yearInput).toHaveAttribute("aria-invalid", "true");
    });
    expect(
      within(dialog).getByText(/that year is already taken/i)
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
