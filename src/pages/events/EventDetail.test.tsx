import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import EventDetail from "./EventDetail";
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

function Harness({ id }: { id: number }) {
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
          <MemoryRouter initialEntries={[`/events/${id}`]}>
            <NotifyProvider>
              <Routes>
                <Route path="/events/:id" element={<EventDetail />} />
              </Routes>
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

describe("EventDetail: status notified state and history", () => {
  it("renders 'Nobody was notified' when statusNotifiedAt is null and the button opens NotifyDialog which POSTs", async () => {
    const user = userEvent.setup();
    const posts: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, statusNotifiedAt: null })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/events/:id/notify`,
        async ({ request }) => {
          posts.push({ url: request.url, body: await request.json() });
          return HttpResponse.json({
            ...f.events[0]!,
            statusNotifiedAt: "2026-12-22T02:00:00.000Z",
          });
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByText(/nobody was notified/i);
    await user.click(
      screen.getByRole("button", { name: /notify subscribers/i })
    );
    // Dialog is open; type a custom message and Send now.
    const field = await screen.findByLabelText(/message/i);
    await user.type(field, "Bundled up? So is Santa.");
    await user.click(screen.getByRole("button", { name: /^send now$/i }));
    await waitFor(() => expect(posts.length).toBe(1));
    expect(posts[0]?.url).toMatch(/\/admin\/events\/\d+\/notify$/);
    expect(posts[0]?.body).toEqual({ message: "Bundled up? So is Santa." });
  });

  it("StatusDialog Change and notify posts { statusId, notify, message } to /status", async () => {
    const user = userEvent.setup();
    const posts: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, statusId: 3 })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/events/:id/status`,
        async ({ request }) => {
          posts.push({ url: request.url, body: await request.json() });
          return HttpResponse.json({ ...f.events[0]!, statusId: 4 });
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    // Open StatusDialog on target 4 (Ended is always allowed).
    await user.click(await screen.findByRole("button", { name: /^ended$/i }));
    const field = await screen.findByLabelText(/message/i);
    await user.type(field, "Safe landing.");
    await user.click(
      screen.getByRole("button", { name: /^change and notify$/i })
    );
    await waitFor(() => expect(posts.length).toBe(1));
    expect(posts[0]?.body).toEqual({
      statusId: 4,
      notify: true,
      message: "Safe landing.",
    });
  });

  it("StatusDialog Change without notifying uses the nested confirmation and sends notify: false", async () => {
    const user = userEvent.setup();
    const posts: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, statusId: 3 })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/events/:id/status`,
        async ({ request }) => {
          posts.push({ url: request.url, body: await request.json() });
          return HttpResponse.json({ ...f.events[0]!, statusId: 4 });
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await user.click(await screen.findByRole("button", { name: /^ended$/i }));
    await screen.findByLabelText(/message/i);
    await user.click(
      screen.getByRole("button", { name: /^change without notifying$/i })
    );
    // Nested confirm dialog: press the same-labelled button inside it.
    expect(posts.length).toBe(0);
    await user.click(
      screen.getByRole("button", { name: /^change without notifying$/i })
    );
    await waitFor(() => expect(posts.length).toBe(1));
    expect(posts[0]?.body).toEqual({
      statusId: 4,
      notify: false,
      message: null,
    });
  });

  it("history table renders the Notified column with the sent count and message excerpt", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id/status-history`, () =>
        HttpResponse.json({
          items: [
            {
              id: 42,
              eventId: 7,
              fromStatusId: 2,
              toStatusId: 3,
              changedBy: "admin@example.com",
              changedAt: "2026-12-22T01:02:11.000Z",
              notify: true,
              message: "Doors are open; Santa is on final approach.",
              sentCount: 812,
            },
            {
              id: 41,
              eventId: 7,
              fromStatusId: 1,
              toStatusId: 2,
              changedBy: "admin@example.com",
              changedAt: "2026-12-22T00:50:00.000Z",
              notify: false,
              message: null,
              sentCount: 0,
            },
          ],
        })
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    const table = await screen.findByTestId("status-history");
    await waitFor(() =>
      expect(within(table).getByText(/812 sent/i)).toBeInTheDocument()
    );
    expect(within(table).getByText(/^No$/)).toBeInTheDocument();
    expect(
      within(table).getByText(/doors are open; santa is on final approach/i)
    ).toBeInTheDocument();
  });

  it("history table shows 'announced again' when fromStatusId equals toStatusId", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id/status-history`, () =>
        HttpResponse.json({
          items: [
            {
              id: 43,
              eventId: 7,
              fromStatusId: 3,
              toStatusId: 3,
              changedBy: "admin@example.com",
              changedAt: "2026-12-22T01:15:00.000Z",
              notify: true,
              message: null,
              sentCount: 100,
            },
          ],
        })
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    const table = await screen.findByTestId("status-history");
    await waitFor(() =>
      expect(within(table).getByText(/announced again/i)).toBeInTheDocument()
    );
  });
});

describe("EventDetail: route poster and flight history blocks", () => {
  it("Remove poster sends PATCH { routeImageMediaId: '' }", async () => {
    const user = userEvent.setup();
    const captured: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          routeImageMediaId: f.mediaAssets[0]!.id,
          routeImage: f.mediaAssets[0]!,
        })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          const body = await request.json();
          captured.push({ url: request.url, body });
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    // Wait for the poster section to render.
    await screen.findByRole("heading", { name: /route poster/i });
    await user.click(
      await screen.findByTestId("route-poster-remove")
    );
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]?.body).toEqual({ routeImageMediaId: "" });
  });

  it("Record from this event calls the /routes/from-event endpoint then PATCH routeId", async () => {
    const user = userEvent.setup();
    const posts: string[] = [];
    const patches: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          routeId: null,
        })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/routes/from-event/:eventId`,
        ({ request }) => {
          posts.push(request.url);
          return HttpResponse.json({ ...f.routes[0]!, id: 42 }, { status: 201 });
        }
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          patches.push({ body: await request.json() });
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /flight history/i });
    await user.click(screen.getByTestId("flight-history-record"));
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    expect(posts[0]).toMatch(/\/admin\/routes\/from-event\//);
    await waitFor(() => expect(patches.length).toBeGreaterThan(0));
    expect(patches[0]?.body).toEqual({ routeId: 42 });
  });

  it("Unlink sends PATCH { routeId: null }", async () => {
    const user = userEvent.setup();
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          routeId: 4,
        })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /flight history/i });
    await user.click(await screen.findByTestId("flight-history-unlink"));
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]?.body).toEqual({ routeId: null });
  });

  it("flight history select preselects the current recording; Use sends PATCH { routeId }", async () => {
    const user = userEvent.setup();
    const patches: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, routeId: 4 })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/routes`, () =>
        HttpResponse.json({
          items: [
            {
              ...f.routes[0]!,
              id: 4,
              name: "2026 draft",
              pointCount: 42,
              createdAt: "2026-11-01T00:00:00.000Z",
            },
            {
              ...f.routes[0]!,
              id: 3,
              name: "2024 recording",
              pointCount: 100,
              createdAt: "2024-11-01T00:00:00.000Z",
            },
          ],
        })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
        HttpResponse.json({
          items: [
            { ...f.events[0]!, routeId: 4, year: 2026 },
            { ...f.events[1]!, routeId: 3, year: 2024 },
          ],
        })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          patches.push({ body: await request.json() });
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /flight history/i });
    // Wait for the select to be preselected with the current route (id 4)
    const select = await screen.findByTestId("flight-history-choose");
    await waitFor(() =>
      expect(within(select).getByText(/2026 draft/i)).toBeInTheDocument()
    );
    // Use is disabled when the selected route is the current one.
    const useBtn = screen.getByTestId("flight-history-use");
    expect(useBtn).toBeDisabled();
    // Open the select and pick the other option.
    await user.click(within(select).getByRole("combobox"));
    const option = await screen.findByRole("option", {
      name: /2024 recording.*100 points.*used by 2024/i,
    });
    await user.click(option);
    await waitFor(() => expect(useBtn).not.toBeDisabled());
    await user.click(useBtn);
    await waitFor(() => expect(patches.length).toBeGreaterThan(0));
    expect(patches[0]?.body).toEqual({ routeId: 3 });
  });

  it("flight history select option 'used by' shows 'no event' when no event links the recording", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, routeId: null })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/routes`, () =>
        HttpResponse.json({
          items: [
            {
              ...f.routes[0]!,
              id: 99,
              name: "Orphan route",
              pointCount: 12,
              createdAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
        HttpResponse.json({ items: [{ ...f.events[0]!, routeId: null }] })
      )
    );
    const user = userEvent.setup();
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /flight history/i });
    const select = await screen.findByTestId("flight-history-choose");
    await user.click(within(select).getByRole("combobox"));
    expect(
      await screen.findByRole("option", { name: /orphan route.*used by no event/i })
    ).toBeInTheDocument();
  });

  it("reopens the picker on 409 media_not_ready from the route poster PATCH", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          routeImageMediaId: f.mediaAssets[0]!.id,
          routeImage: f.mediaAssets[0]!,
        })
      ),
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json(
          {
            code: "media_not_ready",
            message: "media not ready",
            details: null,
            requestId: "req-x",
          },
          { status: 409 }
        )
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /route poster/i });
    await user.click(await screen.findByTestId("route-poster-choose"));
    // Wait for the picker to open, click the asset, then confirm.
    const card = await screen.findByTestId(
      `media-card-${f.mediaAssets[0]!.id}`
    );
    await user.click(within(card).getAllByRole("button")[0]!);
    await user.click(screen.getByRole("button", { name: /^choose$/i }));
    // After the 409, the picker re-opens.
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: /choose route poster/i })
      ).toBeInTheDocument()
    );
  });
});
