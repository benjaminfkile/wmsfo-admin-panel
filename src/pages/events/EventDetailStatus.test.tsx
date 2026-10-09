import {
  describe,
  expect,
  it,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import EventDetail from "./EventDetail";
import { keys } from "../../queries/keys";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { HISTORY_POLL_MS } from "./historyPolling";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

// Fixtures shared by every test, built once.
const api = testConfig.apiBaseUrl;
const event = f.events[0]!;
const eventId = Number(event.id);
const unnotifiedEvent = { ...event, statusNotifiedAt: null };
const notifiedEvent = { ...event, statusNotifiedAt: "2026-12-22T02:00:00.000Z" };
const liveEvent = { ...event, statusId: 3 };
const endedEvent = { ...event, statusId: 4 };
const fullQuota = {
  available: true,
  dryRun: false,
  max24HourSend: 1000,
  sentLast24Hours: 950,
  maxSendRate: 14,
  queued: 40,
  remaining: 10,
  verifiedSubscribers: 1500,
  wouldExceed: true,
  fetchedAt: "2026-12-22T01:31:07.412Z",
};
const historyRow = {
  id: 42,
  eventId: 7,
  fromStatusId: 2,
  toStatusId: 3,
  changedBy: "admin@example.com",
  changedAt: "2026-12-22T01:02:11.000Z",
  notify: true,
  message: "Doors are open; Santa is on final approach.",
  sentCount: 812,
};
const quietHistoryRow = {
  ...historyRow,
  id: 41,
  fromStatusId: 1,
  toStatusId: 2,
  changedAt: "2026-12-22T00:50:00.000Z",
  notify: false,
  message: null,
  sentCount: 0,
};
const againHistoryRow = {
  ...historyRow,
  id: 43,
  fromStatusId: 3,
  toStatusId: 3,
  changedAt: "2026-12-22T01:15:00.000Z",
  message: null,
  sentCount: 100,
};
const getEvent = (body: typeof event) =>
  http.get(`${api}/admin/events/:id`, () => HttpResponse.json(body));
const getQuota = http.get(`${api}/admin/email/quota`, () =>
  HttpResponse.json(fullQuota)
);

// Records what a handler saw; `reach(n)` resolves once n items arrived, so a
// test awaits the request itself instead of polling a counter.
function recorder<T>() {
  const seen: T[] = [];
  const waiters: Array<() => void> = [];
  return {
    seen,
    add(item: T) {
      seen.push(item);
      waiters.splice(0).forEach((wake) => wake());
    },
    async reach(n: number) {
      while (seen.length < n) {
        await new Promise<void>((wake) => waiters.push(wake));
      }
    },
  };
}

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
          <MemoryRouter initialEntries={[`/events/${eventId}`]}>
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
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// The page's queries settle after a test's last assertion (React's act
// warning) and the flight history select gets the event's route id before the
// routes list loads (MUI's out-of-range warning); both are dropped so the file
// prints nothing, and any other console output goes through.
const quiet = /not wrapped in act|out-of-range value/;
const loud = { error: console.error, warn: console.warn };
beforeAll(() => {
  for (const level of ["error", "warn"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      if (!quiet.test(String(args[0]))) loud[level](...args);
    });
  }
});
afterAll(() => {
  vi.mocked(console.error).mockRestore();
  vi.mocked(console.warn).mockRestore();
});

describe("EventDetail: status notified state and history", () => {
  it("renders 'Nobody was notified' when statusNotifiedAt is null and the button opens NotifyDialog which POSTs", async () => {
    const user = userEvent.setup();
    const posts = recorder<{ url: string; body: unknown }>();
    server.use(
      getEvent(unnotifiedEvent),
      http.post(`${api}/admin/events/:id/notify`, async ({ request }) => {
        posts.add({ url: request.url, body: await request.json() });
        return HttpResponse.json(notifiedEvent);
      })
    );
    render(<Harness />);
    await screen.findByText(/nobody was notified/i);
    await user.click(
      screen.getByRole("button", { name: /notify subscribers/i })
    );
    // The dialog is open; paste a custom message and Send now.
    const field = await screen.findByLabelText(/^message/i);
    expect(screen.getByTestId("help-events.detail.notify")).toBeInTheDocument();
    await user.click(field);
    await user.paste("Bundled up? So is Santa.");
    await user.click(screen.getByRole("button", { name: /^send now$/i }));
    await posts.reach(1);
    expect(posts.seen[0]?.url).toMatch(/\/admin\/events\/\d+\/notify$/);
    expect(posts.seen[0]?.body).toEqual({ message: "Bundled up? So is Santa." });
  });

  it("StatusDialog Change and notify posts { statusId, notify, message } to /status", async () => {
    const user = userEvent.setup();
    const posts = recorder<unknown>();
    server.use(
      getEvent(liveEvent),
      http.post(`${api}/admin/events/:id/status`, async ({ request }) => {
        posts.add(await request.json());
        return HttpResponse.json(endedEvent);
      })
    );
    render(<Harness />);
    // Open StatusDialog on target 4 (Ended is always allowed).
    await user.click(await screen.findByRole("button", { name: /^ended$/i }));
    const field = await screen.findByLabelText(/^message/i);
    expect(
      screen.getByTestId("help-events.detail.status-dialog")
    ).toBeInTheDocument();
    await user.click(field);
    await user.paste("Safe landing.");
    await user.click(
      screen.getByRole("button", { name: /^change and notify$/i })
    );
    await posts.reach(1);
    expect(posts.seen[0]).toEqual({
      statusId: 4,
      notify: true,
      message: "Safe landing.",
    });
  });

  it("StatusDialog Change without notifying uses the nested confirmation and sends notify: false", async () => {
    const user = userEvent.setup();
    const posts = recorder<unknown>();
    server.use(
      getEvent(liveEvent),
      http.post(`${api}/admin/events/:id/status`, async ({ request }) => {
        posts.add(await request.json());
        return HttpResponse.json(endedEvent);
      })
    );
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^ended$/i }));
    await screen.findByLabelText(/^message/i);
    await user.click(
      screen.getByRole("button", { name: /^change without notifying$/i })
    );
    // Nested confirm dialog: press the same-labelled button inside it.
    expect(posts.seen).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: /^change without notifying$/i })
    );
    await posts.reach(1);
    expect(posts.seen[0]).toEqual({
      statusId: 4,
      notify: false,
      message: null,
    });
  });

  it("a status change invalidates the messages query so the Messages section refetches", async () => {
    const user = userEvent.setup();
    const messageGets = recorder<true>();
    server.use(
      getEvent(liveEvent),
      http.get(`${api}/admin/events/:id/messages`, () => {
        messageGets.add(true);
        return HttpResponse.json({ items: [] });
      }),
      http.post(`${api}/admin/events/:id/status`, () =>
        HttpResponse.json(endedEvent)
      )
    );
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^ended$/i }));
    await messageGets.reach(1);
    const before = messageGets.seen.length;
    await user.click(await screen.findByLabelText(/^message/i));
    await user.paste("Safe landing.");
    await user.click(
      screen.getByRole("button", { name: /^change and notify$/i })
    );
    await messageGets.reach(before + 1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: keys.eventMessages(eventId),
    });
    invalidate.mockRestore();
  });

  it("an announce invalidates the messages query so the Messages section refetches", async () => {
    const user = userEvent.setup();
    const messageGets = recorder<true>();
    server.use(
      getEvent(unnotifiedEvent),
      http.get(`${api}/admin/events/:id/messages`, () => {
        messageGets.add(true);
        return HttpResponse.json({ items: [] });
      }),
      http.post(`${api}/admin/events/:id/notify`, () =>
        HttpResponse.json(notifiedEvent)
      )
    );
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    render(<Harness />);
    await user.click(
      await screen.findByRole("button", { name: /notify subscribers/i })
    );
    await messageGets.reach(1);
    const before = messageGets.seen.length;
    await user.click(await screen.findByRole("button", { name: /^send now$/i }));
    await messageGets.reach(before + 1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: keys.eventMessages(eventId),
    });
    invalidate.mockRestore();
  });

  it("history table renders the Notified column with the sent count and message excerpt", async () => {
    server.use(
      http.get(`${api}/admin/events/:id/status-history`, () =>
        HttpResponse.json({ items: [historyRow, quietHistoryRow] })
      )
    );
    render(<Harness />);
    const table = await screen.findByTestId("status-history");
    expect(await within(table).findByText(/812 sent/i)).toBeInTheDocument();
    expect(within(table).getByText(/^No$/)).toBeInTheDocument();
    expect(
      within(table).getByText(/doors are open; santa is on final approach/i)
    ).toBeInTheDocument();
  });

  it("NotifyDialog renders the email quota warning when the quota would not fit", async () => {
    const user = userEvent.setup();
    server.use(getEvent(unnotifiedEvent), getQuota);
    render(<Harness />);
    await user.click(
      await screen.findByRole("button", { name: /notify subscribers/i })
    );
    expect(await screen.findByTestId("email-quota-warning")).toBeInTheDocument();
  });

  it("MessagesSection renders the email quota warning only while Notify is checked", async () => {
    const user = userEvent.setup();
    server.use(getQuota);
    render(<Harness />);
    await screen.findByRole("heading", { name: /^messages$/i });
    // Unchecked: no warning.
    expect(screen.queryByTestId("email-quota-warning")).not.toBeInTheDocument();
    // Check the Notify box: the warning appears.
    await user.click(screen.getByRole("checkbox", { name: /notify/i }));
    expect(await screen.findByTestId("email-quota-warning")).toBeInTheDocument();
  });

  it("refetches the history on its own while a fresh notified row is below the verified count", async () => {
    // Fake timers that still run in real time, so the history poll is reached by
    // advancing the clock instead of waiting for it.
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    let historyGets = 0;
    server.use(
      http.get("*/admin/subscribers/summary", () =>
        HttpResponse.json({ verified: 800, pending: 0, unsubscribed: 0 })
      ),
      http.get(`${api}/admin/events/:id/status-history`, () => {
        historyGets += 1;
        return HttpResponse.json({
          items: [
            {
              ...historyRow,
              changedAt: new Date(Date.now() - 2_000).toISOString(),
              message: null,
              sentCount: historyGets * 100,
            },
          ],
        });
      })
    );
    render(<Harness />);
    const table = await screen.findByTestId("status-history");
    expect(await within(table).findByText(/100 sent/i)).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(HISTORY_POLL_MS);
    expect(await within(table).findByText(/200 sent/i)).toBeInTheDocument();
  });

  it("history table shows 'announced again' when fromStatusId equals toStatusId", async () => {
    server.use(
      http.get(`${api}/admin/events/:id/status-history`, () =>
        HttpResponse.json({ items: [againHistoryRow] })
      )
    );
    render(<Harness />);
    const table = await screen.findByTestId("status-history");
    expect(
      await within(table).findByText(/announced again/i)
    ).toBeInTheDocument();
  });
});
