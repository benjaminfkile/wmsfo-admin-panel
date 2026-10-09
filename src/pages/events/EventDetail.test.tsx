import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

// Each test renders the whole detail page and some drive a dialog; give them room.
vi.setConfig({ testTimeout: 15_000 });

// jsdom does not implement `window.matchMedia`; stubbing it to match true
// lets `useCompact` return true and the page renders its compact layout.
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

describe("EventDetail: no route poster card; the flight history block", () => {
  it("renders no route poster card", async () => {
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /flight history/i });
    expect(screen.queryByRole("heading", { name: /route poster/i })).toBeNull();
    expect(screen.queryByTestId("route-poster-choose")).toBeNull();
    expect(screen.queryByTestId("route-poster-remove")).toBeNull();
    expect(screen.queryByRole("button", { name: /choose poster/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /open poster studio/i })).toBeNull();
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
});

describe("EventDetail Clear recording (M42)", () => {
  it("opens the preview, confirms without a beaconId, refetches, and toasts", async () => {
    const user = userEvent.setup();
    const deletes: string[] = [];
    server.use(
      http.get(
        `${testConfig.apiBaseUrl}/admin/events/:id/locations/impact`,
        () =>
          HttpResponse.json({
            blocked: null,
            deletes: [
              {
                entity: "locations",
                count: 1200,
                names: [f.beacons[0]!.name!],
              },
            ],
            unlinks: [],
            warnings: [],
          })
      ),
      http.delete(
        `${testConfig.apiBaseUrl}/admin/events/:id/locations`,
        ({ request }) => {
          deletes.push(request.url);
          return new HttpResponse(null, { status: 204 });
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await user.click(await screen.findByTestId("clear-recording"));
    await screen.findByRole("heading", { name: /^clear recording for/i });
    expect(screen.getByTestId("help-events.detail.clear-recording")).toBeInTheDocument();
    const list = await screen.findByText(
      new RegExp(`${f.beacons[0]!.name!}: 1,200`, "i")
    );
    expect(list).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /^clear recording$/i })
    );
    await waitFor(() => expect(deletes.length).toBe(1));
    // Without ?beaconId=… on the URL, all beacons are cleared.
    expect(deletes[0]).not.toMatch(/beaconId=/);
    // Success toast text lands.
    await screen.findByText(/recording cleared/i);
  });

  it("adds ?beaconId=<id> when the select picks a beacon in the preview", async () => {
    const user = userEvent.setup();
    const deletes: string[] = [];
    server.use(
      http.get(
        `${testConfig.apiBaseUrl}/admin/events/:id/locations/impact`,
        () =>
          HttpResponse.json({
            blocked: null,
            deletes: [
              {
                entity: "locations",
                count: 1200,
                names: [f.beacons[0]!.name!],
              },
            ],
            unlinks: [],
            warnings: [],
          })
      ),
      http.delete(
        `${testConfig.apiBaseUrl}/admin/events/:id/locations`,
        ({ request }) => {
          deletes.push(request.url);
          return new HttpResponse(null, { status: 204 });
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await user.click(await screen.findByTestId("clear-recording"));
    const select = await screen.findByLabelText(/^beacon$/i);
    await user.click(select);
    const option = await screen.findByRole("option", {
      name: f.beacons[0]!.name!,
    });
    await user.click(option);
    await user.click(
      screen.getByRole("button", { name: /^clear recording$/i })
    );
    await waitFor(() => expect(deletes.length).toBe(1));
    expect(deletes[0]).toMatch(
      new RegExp(`beaconId=${f.beacons[0]!.id}`)
    );
  });

  it("blocks the action while the event is live with the API's sentence", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        `${testConfig.apiBaseUrl}/admin/events/:id/locations/impact`,
        () =>
          HttpResponse.json({
            blocked: "This event is live. End it first.",
            deletes: [],
            unlinks: [],
            warnings: [],
          })
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await user.click(await screen.findByTestId("clear-recording"));
    expect(
      await screen.findByText(/this event is live\. end it first\./i)
    ).toBeInTheDocument();
    // The confirm button is replaced by Close alone.
    expect(
      screen.queryByRole("button", { name: /^clear recording$/i })
    ).toBeNull();
    expect(screen.getByRole("button", { name: /^close$/i })).toBeInTheDocument();
  });

  it("toasts the API message on a 409 conflict", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        `${testConfig.apiBaseUrl}/admin/events/:id/locations/impact`,
        () =>
          HttpResponse.json({
            blocked: null,
            deletes: [
              { entity: "locations", count: 3, names: [f.beacons[0]!.name!] },
            ],
            unlinks: [],
            warnings: [],
          })
      ),
      http.delete(
        `${testConfig.apiBaseUrl}/admin/events/:id/locations`,
        () =>
          HttpResponse.json(
            {
              code: "event_live",
              message: "This event just went live.",
              details: null,
              requestId: "req-cr",
            },
            { status: 409 }
          )
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await user.click(await screen.findByTestId("clear-recording"));
    await screen.findByRole("heading", { name: /^clear recording for/i });
    await user.click(
      screen.getByRole("button", { name: /^clear recording$/i })
    );
    await screen.findByText(/this event just went live\./i);
  });
});

describe("EventDetail on compact (admin.md 6.3)", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("renders the history as cards (no table) and shows the wrapped Details actions row", async () => {
    restore = stubMatchMedia(true);
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id/status-history`, () =>
        HttpResponse.json({
          items: [
            {
              id: 51,
              eventId: 7,
              fromStatusId: 2,
              toStatusId: 3,
              changedBy: "admin@example.com",
              changedAt: "2026-12-22T01:02:11.000Z",
              notify: true,
              message: "Doors are open; Santa is on final approach.",
              sentCount: 812,
            },
          ],
        })
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    const history = await screen.findByTestId("status-history");
    // On compact the history renders as cards, not a table.
    expect(within(history).queryByRole("table")).toBeNull();
    await waitFor(() =>
      expect(within(history).getByText(/812 sent/i)).toBeInTheDocument()
    );
    // Details actions row wraps (flexWrap on the Stack container).
    const actions = await screen.findByTestId("event-details-actions");
    expect(actions).toHaveStyle({ "flex-wrap": "wrap" });
  });

  it("caps the history box at 320 px and scrolls it; the Status card is not positioned", async () => {
    restore = stubMatchMedia(true);
    render(<Harness id={Number(f.events[0]!.id)} />);
    const history = await screen.findByTestId("status-history");
    expect(history).toHaveStyle({ "max-height": "320px", "overflow-y": "auto" });
    expect(screen.getByTestId("status-card")).not.toHaveStyle({
      position: "absolute",
    });
  });

  it("caps the messages list box at 320 px and leaves the Messages card uncapped", async () => {
    restore = stubMatchMedia(true);
    render(<Harness id={Number(f.events[0]!.id)} />);
    const list = await screen.findByTestId("messages-list");
    expect(list).toHaveStyle({ "max-height": "320px", "overflow-y": "auto" });
    const card = list.closest(".MuiCard-root") as HTMLElement;
    expect(getComputedStyle(card).maxHeight).toBe("");
  });
});

// A stand-in `ResizeObserver` whose `observe` reports a 480 px content
// height, the size the Status card measures at in the desktop test.
class FakeResizeObserver {
  callback: (entries: { contentRect: { height: number } }[]) => void;
  constructor(
    callback: (entries: { contentRect: { height: number } }[]) => void
  ) {
    this.callback = callback;
  }
  observe() {
    this.callback([{ contentRect: { height: 480 } }]);
  }
  unobserve() {}
  disconnect() {}
}

describe("EventDetail: the Status card height on desktop (admin.md 6.3)", () => {
  it("positions the Status card over its grid item and scrolls the history inside it", async () => {
    render(<Harness id={Number(f.events[0]!.id)} />);
    const history = await screen.findByTestId("status-history");
    expect(history).toHaveStyle({ "overflow-y": "auto", "min-height": "120px" });
    expect(history).not.toHaveStyle({ "max-height": "320px" });
    const card = screen.getByTestId("status-card");
    expect(card).toHaveStyle({
      position: "absolute",
      display: "flex",
      "flex-direction": "column",
    });
    expect(card.parentElement).toHaveStyle({ position: "relative" });
    // The history table keeps its header in view while the box scrolls.
    const table = await within(history).findByRole("table");
    expect(table).toHaveClass("MuiTable-stickyHeader");
  });

  it("caps the Messages card at the Status card's measured height and scrolls the list inside it", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    try {
      render(<Harness id={Number(f.events[0]!.id)} />);
      const list = await screen.findByTestId("messages-list");
      const card = list.closest(".MuiCard-root") as HTMLElement;
      await waitFor(() => expect(card).toHaveStyle({ "max-height": "480px" }));
      expect(card).toHaveStyle({ display: "flex", "flex-direction": "column" });
      expect(list).toHaveStyle({ "overflow-y": "auto" });
      expect(list).not.toHaveStyle({ "max-height": "320px" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("EventDetail: the schedule timezone (admin.md 7.5)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults the zone to the stored one and reads the wall time in it", async () => {
    const user = userEvent.setup();
    const patches: unknown[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, scheduleTimeZone: "Asia/Tokyo" })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          patches.push(await request.json());
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);

    const zone = await screen.findByRole("combobox", { name: /timezone/i });
    await waitFor(() => expect(zone).toHaveValue("Asia/Tokyo"));
    const scheduled = screen.getByLabelText(/scheduled at/i);
    // 01:00 UTC is 10:00 in Tokyo.
    expect(scheduled).toHaveValue("2026-12-22T10:00");
    expect(screen.getByLabelText(/went live at/i)).toHaveValue(
      "2026-12-22T10:02"
    );
    expect(within(screen.getByTestId("event-details-actions")).getByRole("button", { name: /^save$/i })).toBeDisabled();

    fireEvent.change(scheduled, { target: { value: "2026-12-22T12:00" } });
    await user.click(within(screen.getByTestId("event-details-actions")).getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(patches.length).toBe(1));
    expect(patches[0]).toEqual({ scheduledAt: "2026-12-22T03:00:00.000Z" });
  });

  it("defaults to the browser zone when none is stored and sends it with the times", async () => {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions"
    ).mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: "America/Denver" };
    });
    const user = userEvent.setup();
    const patches: unknown[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, scheduleTimeZone: null })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          patches.push(await request.json());
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);

    const zone = await screen.findByRole("combobox", { name: /timezone/i });
    const scheduled = screen.getByLabelText(/scheduled at/i);
    // 01:00 UTC on Dec 22 is 18:00 MST on Dec 21.
    await waitFor(() => expect(scheduled).toHaveValue("2026-12-21T18:00"));
    expect(zone).toHaveValue("America/Denver");
    expect(within(screen.getByTestId("event-details-actions")).getByRole("button", { name: /^save$/i })).toBeDisabled();

    fireEvent.change(scheduled, { target: { value: "2026-12-21T19:00" } });
    await user.click(within(screen.getByTestId("event-details-actions")).getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(patches.length).toBe(1));
    expect(patches[0]).toEqual({
      scheduledAt: "2026-12-22T02:00:00.000Z",
      scheduleTimeZone: "America/Denver",
    });
  });

  it("switching the zone re-renders the wall times and keeps the instant", async () => {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions"
    ).mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: "America/Denver" };
    });
    const user = userEvent.setup();
    const patches: unknown[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, scheduleTimeZone: null })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          patches.push(await request.json());
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);

    const zone = await screen.findByRole("combobox", { name: /timezone/i });
    const scheduled = screen.getByLabelText(/scheduled at/i);
    await waitFor(() => expect(scheduled).toHaveValue("2026-12-21T18:00"));

    await user.click(zone);
    await user.clear(zone);
    await user.type(zone, "America/Chicago");
    await user.click(await screen.findByRole("option", { name: "America/Chicago" }));

    // Same instant, one hour later on the wall.
    await waitFor(() => expect(scheduled).toHaveValue("2026-12-21T19:00"));

    await user.click(within(screen.getByTestId("event-details-actions")).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patches.length).toBe(1));
    // The instants are untouched, so only the zone is patched.
    expect(patches[0]).toEqual({ scheduleTimeZone: "America/Chicago" });
  });

  it("clearing Went live at and Ended at patches them as null", async () => {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "resolvedOptions"
    ).mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: "America/Denver" };
    });
    const user = userEvent.setup();
    const patches: unknown[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          wentLiveAt: "2026-12-22T01:02:00.000Z",
          endedAt: "2026-12-22T03:04:00.000Z",
        })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          patches.push(await request.json());
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);

    const wentLive = await screen.findByLabelText(/went live at/i);
    const ended = screen.getByLabelText(/ended at/i);
    await waitFor(() => expect(wentLive).not.toHaveValue(""));
    // The Clear buttons sit beside Scheduled at, Went live at, and Ended at.
    const clears = screen.getAllByRole("button", { name: /^clear$/i });
    expect(clears.length).toBe(3);
    await user.click(clears[1]!);
    await user.click(clears[2]!);
    expect(wentLive).toHaveValue("");
    expect(ended).toHaveValue("");

    await user.click(within(screen.getByTestId("event-details-actions")).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(patches.length).toBe(1));
    // A time edit also persists the zone it was edited in (the defaulted
    // browser zone here).
    expect(patches[0]).toEqual({
      wentLiveAt: null,
      endedAt: null,
      scheduleTimeZone: "America/Denver",
    });
  });
});

describe("EventDetail: the Route map card (admin.md 6.3)", () => {
  it("shows the card with its summary", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0],
          routeMapConfig: {
            display: { routeWidth: "thick" },
          },
        })
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    const card = await screen.findByTestId("route-map-card");
    expect(within(card).queryByTestId("route-map-landmarks")).toBeNull();
    expect(within(card).getByText("Route line: Thick")).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Configure route map" })
    ).toBeInTheDocument();
  });
});

describe("EventDetail: the Postponed status", () => {
  it("offers an enabled Postponed button and posts statusId 6", async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({ ...f.events[0]!, statusId: 1, isCurrent: false, scheduledAt: null })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/events/:id/status`,
        async ({ request }) => {
          posts.push(await request.json());
          return HttpResponse.json({ ...f.events[0]!, statusId: 6 });
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    const btn = await screen.findByRole("button", { name: /^postponed$/i });
    expect(btn).toBeEnabled();
    await user.click(btn);
    await user.click(
      await screen.findByRole("button", { name: /^change and notify$/i })
    );
    await waitFor(() => expect(posts.length).toBe(1));
    expect(posts[0]).toMatchObject({ statusId: 6, notify: true });
  });
});

describe("EventDetail help buttons (admin.md 6.26)", () => {
  it("mounts the header help and every card help of the default render", async () => {
    render(<Harness id={Number(f.events[0]!.id)} />);
    for (const key of [
      "events.detail",
      "events.detail.details",
      "events.detail.status",
      "events.detail.messages",
      "events.detail.flight-history",
      "events.detail.route-map",
      "events.detail.locations",
    ]) {
      expect(await screen.findByTestId(`help-${key}`)).toBeInTheDocument();
    }
  });
});
