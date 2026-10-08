import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

vi.setConfig({ testTimeout: 15_000 });

const API = testConfig.apiBaseUrl;
const EVENT = f.events[0]!;

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

// Serves the event in the given status and counts its reads.
function serveEvent(statusId: number): { reads: () => number } {
  let n = 0;
  server.use(
    http.get(`${API}/admin/events/:id`, () => {
      n += 1;
      return HttpResponse.json({ ...EVENT, statusId });
    })
  );
  return { reads: () => n };
}

async function renderLive() {
  render(<Harness id={Number(EVENT.id)} />);
  return screen.findByTestId("seed-cookies");
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

describe("SeedCookiesSection: shown only on a live event", () => {
  it.each([2, 4])("is absent in status %i", async (statusId) => {
    serveEvent(statusId);
    render(<Harness id={Number(EVENT.id)} />);
    await screen.findByRole("heading", { name: "Messages" });
    expect(screen.queryByTestId("seed-cookies")).toBeNull();
    expect(screen.queryByText("Seed cookies")).toBeNull();
  });

  it("is present in status 3 with one row per active cookie type", async () => {
    serveEvent(3);
    server.use(
      http.get(`${API}/admin/cookie-types`, () =>
        HttpResponse.json({
          items: [
            ...f.cookieTypes,
            { ...f.cookieTypes[0]!, id: 9, name: "Retired", active: false },
          ],
        })
      )
    );
    const card = await renderLive();
    expect(within(card).getByTestId("help-events.detail.seed-cookies")).toBeInTheDocument();
    expect(within(card).getByText("Seed cookies")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Adds cookies to the live tally. They count like visitors' cookies and are never shown as anyone's."
      )
    ).toBeInTheDocument();
    await within(card).findByText("Chocolate chip");
    expect(within(card).getByText("Gingerbread")).toBeInTheDocument();
    expect(within(card).queryByText("Retired")).toBeNull();
    expect(within(card).getByTestId("seed-total")).toHaveTextContent("0 cookies");
  });
});

describe("SeedCookiesSection: counts", () => {
  it("steps and typing clamp to 0 and 100", async () => {
    const user = userEvent.setup();
    serveEvent(3);
    const card = await renderLive();
    const field = await within(card).findByLabelText("Chocolate chip cookies");
    const fewer = within(card).getByRole("button", { name: "One fewer Chocolate chip" });
    const more = within(card).getByRole("button", { name: "One more Chocolate chip" });

    expect(field).toHaveValue(0);
    expect(fewer).toBeDisabled();
    await user.click(more);
    await user.click(more);
    expect(field).toHaveValue(2);
    await user.click(fewer);
    expect(field).toHaveValue(1);
    expect(within(card).getByTestId("seed-total")).toHaveTextContent("1 cookie");

    await user.clear(field);
    await user.type(field, "250");
    expect(field).toHaveValue(100);
    expect(more).toBeDisabled();

    fireEvent.change(field, { target: { value: "-5" } });
    expect(field).toHaveValue(0);
  });

  it("disables Seed at zero", async () => {
    const user = userEvent.setup();
    serveEvent(3);
    const card = await renderLive();
    const seed = within(card).getByRole("button", { name: "Seed" });
    expect(seed).toBeDisabled();
    await user.click(
      await within(card).findByRole("button", { name: "One more Gingerbread" })
    );
    expect(seed).toBeEnabled();
    await user.click(within(card).getByRole("button", { name: "One fewer Gingerbread" }));
    expect(seed).toBeDisabled();
  });
});

describe("SeedCookiesSection: seeding", () => {
  it("confirm posts only the non-zero items, toasts, and resets", async () => {
    const user = userEvent.setup();
    const ev = serveEvent(3);
    let typeReads = 0;
    const posts: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.get(`${API}/admin/cookie-types`, () => {
        typeReads += 1;
        return HttpResponse.json({ items: f.cookieTypes });
      }),
      http.post(`${API}/admin/events/:id/cookies`, async ({ request }) => {
        posts.push({ url: request.url, body: await request.json() });
        return HttpResponse.json(
          { eventId: EVENT.id, seeded: 25, cookieTally: { "3": 25 } },
          { status: 201 }
        );
      })
    );
    const card = await renderLive();
    const field = await within(card).findByLabelText("Gingerbread cookies");
    await user.clear(field);
    await user.type(field, "25");
    expect(within(card).getByTestId("seed-total")).toHaveTextContent("25 cookies");

    await user.click(within(card).getByRole("button", { name: "Seed" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "Seed 25 cookies on Santa Flyover 2026? This cannot be undone."
      )
    ).toBeInTheDocument();
    const eventReads = ev.reads();
    const typesBefore = typeReads;
    await user.click(within(dialog).getByRole("button", { name: "Seed" }));

    await waitFor(() => expect(posts.length).toBe(1));
    expect(posts[0]!.url).toMatch(/\/admin\/events\/7\/cookies$/);
    expect(posts[0]!.body).toEqual({ items: [{ cookieTypeId: 3, count: 25 }] });
    expect(await screen.findByText("Seeded 25 cookies")).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveValue(0));
    expect(within(card).getByTestId("seed-total")).toHaveTextContent("0 cookies");
    await waitFor(() => expect(ev.reads()).toBeGreaterThan(eventReads));
    await waitFor(() => expect(typeReads).toBeGreaterThan(typesBefore));
  });

  it("409 event_not_live shows the message and refetches the event", async () => {
    const user = userEvent.setup();
    const ev = serveEvent(3);
    server.use(
      http.post(`${API}/admin/events/:id/cookies`, () =>
        HttpResponse.json(
          {
            code: "event_not_live",
            message: "Event is not live",
            details: null,
            requestId: "req-1",
          },
          { status: 409 }
        )
      )
    );
    const card = await renderLive();
    await user.click(
      await within(card).findByRole("button", { name: "One more Chocolate chip" })
    );
    await user.click(within(card).getByRole("button", { name: "Seed" }));
    const dialog = await screen.findByRole("dialog");
    const eventReads = ev.reads();
    await user.click(within(dialog).getByRole("button", { name: "Seed" }));

    expect(
      await within(card).findByText("The event is no longer live.")
    ).toBeInTheDocument();
    await waitFor(() => expect(ev.reads()).toBeGreaterThan(eventReads));
  });

  it("hides the card once the refetched event is no longer live", async () => {
    const user = userEvent.setup();
    let statusId = 3;
    server.use(
      http.get(`${API}/admin/events/:id`, () =>
        HttpResponse.json({ ...EVENT, statusId })
      ),
      http.post(`${API}/admin/events/:id/cookies`, () => {
        statusId = 4;
        return HttpResponse.json(
          {
            code: "event_not_live",
            message: "Event is not live",
            details: null,
            requestId: "req-2",
          },
          { status: 409 }
        );
      })
    );
    const card = await renderLive();
    await user.click(
      await within(card).findByRole("button", { name: "One more Chocolate chip" })
    );
    await user.click(within(card).getByRole("button", { name: "Seed" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Seed" }));
    await waitFor(() => expect(screen.queryByTestId("seed-cookies")).toBeNull());
  });
});
