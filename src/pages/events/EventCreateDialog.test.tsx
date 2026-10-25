import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CssBaseline, ThemeProvider } from "@mui/material";
import EventCreateDialog from "./EventCreateDialog";
import type { CreateEventBody } from "../../api/resources/events";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildTheme } from "../../theme/theme";
import { formatStamp } from "../../lib/time";
import { http, HttpResponse } from "msw";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import type { Event, TrackerMap } from "../../api/types";
import type { Config } from "../../config";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import { FakeMap, startViewMap } from "../../test/fakeGoogleMap";
import { ApiError } from "../../api/errors";

// Without the Maps key the box editor shows its fields alone.
const config = { ...testConfig, googleMapsKey: "" };

// The box editor's Google map, for the tests that drag a handle.
type Point = { lat: number; lng: number };
const handles: Array<{ title: string; position: Point; drag: (p: Point) => void }> = [];
vi.mock("../../pages/places/googleMaps", async () => {
  const { FakeMap: Map } = await import("../../test/fakeGoogleMap");
  class Overlay {
    setMap() {}
    setBounds() {}
    setPaths() {}
  }
  class Marker {
    title: string;
    position: Point;
    onDrag: Array<() => void> = [];
    constructor(o: { title: string; position: Point }) {
      this.title = o.title;
      this.position = o.position;
      handles.push(this);
    }
    setMap() {}
    setPosition(p: Point) {
      this.position = p;
    }
    getPosition() {
      const p = this.position;
      return { lat: () => p.lat, lng: () => p.lng };
    }
    addListener(_name: string, cb: () => void) {
      this.onDrag.push(cb);
      return { remove: () => undefined };
    }
    drag(p: Point) {
      this.position = p;
      for (const cb of this.onDrag) cb();
    }
  }
  return {
    loadMaps: vi.fn(async () => ({ Map, Rectangle: Overlay, Polygon: Overlay })),
    loadMarkers: vi.fn(async () => ({ Marker })),
    loadPlaces: vi.fn(async () => ({})),
  };
});

// A ready map without terrain beside the seeded valley map and the
// pending package of the fixtures.
const FLATHEAD: TrackerMap = {
  ...f.trackerMaps[0]!,
  id: 3,
  name: "Flathead",
  prefix: "maps/3",
  bbox: { west: -114.6, south: 47.7, east: -113.9, north: 48.4 },
  terrainUrl: null,
  terrainBytes: null,
  terrainMaxZoom: null,
};

vi.setConfig({ testTimeout: 15_000 });

// The browser zone comes from Intl's resolved options; pin it so the
// default is predictable.
beforeEach(() => {
  handles.length = 0;
  FakeMap.instances.length = 0;
  server.use(
    http.get(`${config.apiBaseUrl}/admin/maps`, () =>
      HttpResponse.json({ items: [f.trackerMaps[0], FLATHEAD, f.trackerMaps[1]] })
    )
  );
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: "America/Denver" };
    }
  );
  installClient({
    config,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderDialog(
  onSubmit: (b: CreateEventBody) => void,
  events: Event[] = [],
  withConfig: Config = config,
  error: unknown = null
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ConfigProvider config={withConfig}>
      <QueryClientProvider client={client}>
        <ThemeProvider theme={buildTheme("light")}>
          <CssBaseline />
          <NotifyProvider>
            <EventCreateDialog
              open
              events={events}
              submitting={false}
              error={error}
              onCancel={() => undefined}
              onSubmit={onSubmit}
            />
          </NotifyProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

const SITE_BOX = { west: -114.2, south: 46.8, east: -113.9, north: 47.0 };

function withSiteBox() {
  server.use(
    http.get(`${config.apiBaseUrl}/admin/site-settings`, () =>
      HttpResponse.json({
        ...f.siteSettingsDraft,
        data: { ...(f.siteSettingsDraft.data as Record<string, unknown>), tracker: { defaultBbox: SITE_BOX } },
      })
    )
  );
}

function field(side: string): HTMLInputElement {
  return screen.getByTestId(`bbox-${side}`) as HTMLInputElement;
}

function mapSelect(): HTMLElement {
  return screen.getByRole("combobox", { name: /^map$/i });
}

async function pickMap(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(mapSelect());
  await user.click(await screen.findByRole("option", { name }));
}

describe("EventCreateDialog: Tracker area", () => {
  it("prefills the box from the settings draft and sends it with no map when no event exists", async () => {
    withSiteBox();
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    expect(screen.getByTestId("help-events.create.bbox")).toBeInTheDocument();
    expect(screen.getByText("Tracker area")).toBeInTheDocument();
    await waitFor(() => expect(field("west").value).toBe("-114.2000"));
    expect(field("north").value).toBe("47.0000");
    expect(mapSelect()).toHaveTextContent("No map");

    await user.type(screen.getByLabelText(/^name/i), "Area flight");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.trackerBbox).toEqual(SITE_BOX);
    expect(body.trackerMapId).toBeNull();
    expect(Object.keys(body)).not.toContain("routeId");
    expect(Object.keys(body)).not.toContain("inheritRoute");
  });

  it("lists No map and every ready map by name with its terrain word", async () => {
    const user = userEvent.setup();
    renderDialog(vi.fn());
    await screen.findByText(/will use no map/i);
    await user.click(mapSelect());
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "No map",
      "FlatheadNo terrain",
      "Missoula valleyWith terrain",
    ]);
  });

  it("picking a map fills the box with its area and sends trackerMapId with that box", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    await screen.findByText(/will use no map/i);
    await pickMap(user, /Flathead/);
    expect(field("west").value).toBe("-114.6000");
    expect(field("south").value).toBe("47.7000");
    expect(field("east").value).toBe("-113.9000");
    expect(field("north").value).toBe("48.4000");
    expect(screen.queryByRole("button", { name: "Use site default" })).toBeNull();
    expect(screen.getByTestId("tracker-preview")).toHaveTextContent(
      "Will use the map Flathead and every theme"
    );
    // Switching maps resets the box to the new map's area.
    await pickMap(user, /Missoula valley/);
    expect(field("west").value).toBe("-114.7500");
    expect(field("north").value).toBe("47.2500");

    await user.type(screen.getByLabelText(/^name/i), "Map flight");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.trackerMapId).toBe(1);
    expect(body.trackerBbox).toEqual(f.trackerMaps[0]!.bbox);
  });

  it("a handle dragged past the map's edge stops on it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit, [], testConfig);
    await screen.findByText(/will use no map/i);
    await pickMap(user, /Flathead/);
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(handles).toHaveLength(4));
    const se = handles.find((h) => h.title === "Drag the se corner")!;
    act(() => se.drag({ lat: 47.9, lng: -112 }));
    expect(field("east").value).toBe("-113.9000");
    expect(field("south").value).toBe("47.9000");
    expect(se.position).toEqual({ lat: 47.9, lng: -113.9 });

    await user.type(screen.getByLabelText(/^name/i), "Shrunk flight");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.trackerMapId).toBe(3);
    expect(body.trackerBbox).toEqual({ west: -114.6, south: 47.9, east: -113.9, north: 48.4 });
  });

  it("No map sends null and allows a free box", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    await screen.findByText(/will use no map/i);
    await pickMap(user, /Flathead/);
    await pickMap(user, /^No map$/);
    // No map keeps the box for drawing.
    expect(field("west").value).toBe("-114.6000");
    fireEvent.change(field("west"), { target: { value: "-116" } });
    fireEvent.blur(field("west"));
    expect(screen.queryByTestId("bbox-outside")).toBeNull();
    await user.type(screen.getByLabelText(/^name/i), "Free flight");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.trackerMapId).toBeNull();
    expect(body.trackerBbox).toEqual({ west: -116, south: 47.7, east: -113.9, north: 48.4 });
  });

  it("shows the Missoula valley box without a tracker key, and Use site default puts it back", async () => {
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    await screen.findByText(/will use no map/i);
    expect(field("west").value).toBe("-114.7500");
    expect(field("south").value).toBe("46.3500");
    expect(field("east").value).toBe("-113.3000");
    expect(field("north").value).toBe("47.2500");

    fireEvent.change(field("west"), { target: { value: "-114.5" } });
    expect(field("west").value).toBe("-114.5");
    fireEvent.click(screen.getByRole("button", { name: "Use site default" }));
    expect(field("west").value).toBe("-114.7500");
  });

  it("disables Create while the box breaks a rule", async () => {
    renderDialog(vi.fn());
    await screen.findByText(/will use no map/i);
    fireEvent.change(field("east"), { target: { value: "-115" } });
    expect(screen.getByText("West must be less than east")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("starts on the map the API would inherit and names it with the copied themes", async () => {
    withSiteBox();
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit, f.events);
    const line = await screen.findByTestId("tracker-preview");
    await waitFor(() =>
      expect(line).toHaveTextContent(
        "Will use the map Missoula valley and the themes Light, Dark from Santa Flyover 2026"
      )
    );
    expect(mapSelect()).toHaveTextContent("Missoula valley");
    // The site box lies inside the map, so it stands.
    expect(field("west").value).toBe("-114.2000");
    await pickMap(user, /^No map$/);
    expect(line).toHaveTextContent(
      "Will use no map and the themes Light, Dark from Santa Flyover 2026"
    );
    await pickMap(user, /Missoula valley/);
    await user.type(screen.getByLabelText(/^name/i), "Next flight");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.trackerMapId).toBe(1);
    expect(body.trackerBbox).toEqual(f.trackerMaps[0]!.bbox);
  });

  it("says no map and every theme with no event", async () => {
    renderDialog(vi.fn());
    expect(await screen.findByTestId("tracker-preview")).toHaveTextContent(
      "Will use no map and every theme"
    );
  });
});

describe("EventCreateDialog: the start view", () => {
  it("has none by default: the line says the whole area and the body leaves it out", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    expect(await screen.findByTestId("tracker-preview")).toHaveTextContent(
      "Will use no map and every theme, opening on the whole area"
    );
    expect(screen.getByTestId("start-view-caption")).toHaveTextContent("Whole area");
    expect(screen.getByRole("button", { name: "Use whole area" })).toBeDisabled();
    await user.type(screen.getByLabelText(/^name/i), "Whole flight");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(Object.keys(body)).not.toContain("trackerStartView");
  });

  it("moving the map sets the start view, named in the line and sent in the body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit, [], testConfig);
    await screen.findByText(/will use no map/i);
    await waitFor(() => expect(startViewMap()?.options.restriction).toBeDefined());
    act(() => startViewMap()!.pan({ lat: 46.87123, lng: -113.99456 }, 11));
    expect(screen.getByTestId("tracker-preview")).toHaveTextContent(
      "opening at 46.87123, -113.99456, zoom 11"
    );
    await user.type(screen.getByLabelText(/^name/i), "Viewed flight");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.trackerStartView).toEqual({
      center: { lat: 46.87123, lng: -113.99456 },
      zoom: 11,
    });

    // Use whole area takes it back out.
    await user.click(screen.getByRole("button", { name: "Use whole area" }));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const second = onSubmit.mock.calls[1]![0] as CreateEventBody;
    expect(Object.keys(second)).not.toContain("trackerStartView");
  });

  it("picking a map that leaves the centre out moves it inside and says so", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit, [], testConfig);
    await screen.findByText(/will use no map/i);
    await waitFor(() => expect(startViewMap()?.options.restriction).toBeDefined());
    act(() => startViewMap()!.pan({ lat: 46.87, lng: -114 }, 11));
    await pickMap(user, /Flathead/);
    expect(screen.getByTestId("start-view-moved")).toHaveTextContent(
      "Start view moved inside the new area"
    );
    await user.type(screen.getByLabelText(/^name/i), "Moved flight");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.trackerStartView).toEqual({ center: { lat: 47.7, lng: -114 }, zoom: 11 });
  });

  it("a 400 at trackerStartView shows under the field", async () => {
    const error = new ApiError(400, {
      code: "validation_failed",
      message: "Validation failed",
      details: { fields: { "/trackerStartView": "must lie inside trackerBbox" } },
      requestId: "req-5",
    });
    renderDialog(vi.fn(), [], config, error);
    expect(await screen.findByTestId("start-view-error")).toHaveTextContent(
      "must lie inside trackerBbox"
    );
  });
});

describe("EventCreateDialog: no route", () => {
  it("offers no route control: the route is a site setting", async () => {
    renderDialog(vi.fn(), f.events);
    await screen.findByTestId("tracker-preview");
    expect(screen.queryByText(/^route$/i)).toBeNull();
    expect(screen.queryByLabelText(/inherit the most recent route/i)).toBeNull();
    expect(screen.queryByLabelText(/choose a route/i)).toBeNull();
    expect(screen.queryByLabelText(/no route/i)).toBeNull();
    expect(screen.queryByText(/will inherit/i)).toBeNull();
  });
});

describe("EventCreateDialog: timezone", () => {
  it("defaults the zone to the browser zone and reads the scheduled time in it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    expect(screen.getByTestId("help-events.create")).toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: /timezone/i })).toHaveValue(
      "America/Denver"
    );
    await user.type(screen.getByLabelText(/^name/i), "Night flight");
    fireEvent.change(screen.getByLabelText(/scheduled at/i), {
      target: { value: "2026-11-01T01:30" },
    });
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.scheduledAt).toBe("2026-11-01T07:30:00.000Z");
    expect(body.scheduleTimeZone).toBe("America/Denver");
  });

  it("sends the picked zone and converts the wall time through it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);

    const zone = screen.getByRole("combobox", { name: /timezone/i });
    await user.click(zone);
    await user.clear(zone);
    await user.type(zone, "Asia/Tok");
    await user.click(await screen.findByRole("option", { name: "Asia/Tokyo" }));
    expect(zone).toHaveValue("Asia/Tokyo");

    await user.type(screen.getByLabelText(/^name/i), "Tokyo flight");
    fireEvent.change(screen.getByLabelText(/scheduled at/i), {
      target: { value: "2026-12-24T19:00" },
    });
    // The helper text shows the instant in the viewer's zone.
    expect(
      screen.getByText(formatStamp("2026-12-24T10:00:00.000Z"))
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.scheduledAt).toBe("2026-12-24T10:00:00.000Z");
    expect(body.scheduleTimeZone).toBe("Asia/Tokyo");
  });
});
