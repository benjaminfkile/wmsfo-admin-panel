import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import RouteMapSection from "./RouteMapSection";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import type { Event } from "../../api/types";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import {
  NO_MAP_HINT,
  NO_THEME_HINT,
  eventRouteMapStyle,
  resolveRouteMapConfig,
} from "../../routeMap/eventRouteMap";
import { TIME_LABELS_LAYER } from "../../routeMap";

vi.setConfig({ testTimeout: 20_000 });

// The preview maps: the options they were created with and every style
// set on them since.
type PreviewMap = { options: Record<string, unknown>; styles: unknown[] };
const maps: PreviewMap[] = [];

vi.mock("maplibre-gl", () => {
  class Map {
    private record: PreviewMap;
    private images: string[] = [];
    constructor(opts: Record<string, unknown>) {
      this.record = { options: opts, styles: [opts.style] };
      maps.push(this.record);
    }
    on() {
      return this;
    }
    hasImage(id: string) {
      return this.images.includes(id);
    }
    addImage(id: string) {
      this.images.push(id);
    }
    setStyle(style: unknown) {
      this.record.styles.push(style);
    }
    fitBounds() {
      return this;
    }
    resize() {
      return this;
    }
    remove() {
      return undefined;
    }
  }
  return { Map, addProtocol: () => undefined, setWorkerUrl: () => undefined };
});

vi.mock("pmtiles", () => ({
  Protocol: class {
    tile = () => undefined;
  },
  PMTiles: class {
    getHeader() {
      return Promise.reject(new Error("404"));
    }
  },
}));

// The pin picker's map never loads here; its number fields place the pin.
vi.mock("../places/googleMaps", () => ({
  loadMaps: vi.fn(async () => {
    throw new Error("Maps unavailable in tests");
  }),
  loadMarkers: vi.fn(async () => ({})),
  loadPlaces: vi.fn(async () => ({})),
}));

// The shared style call, wrapped so the tests can read every input the
// preview passes it.
vi.mock("../../routeMap/eventRouteMap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../routeMap/eventRouteMap")>();
  return { ...actual, eventRouteMapStyle: vi.fn(actual.eventRouteMapStyle) };
});

const FULL_CONFIG = {
  display: {
    timeLabelIntervalMinutes: 10,
    arrows: false,
    arrowSize: "large",
    routeWidth: "thick",
    labelSize: "small",
  },
  controls: { fullscreen: false, terrain: false },
};

const ROUTE_MAP = {
  routeMap: {
    path: [
      { lat: 46.8721, lng: -114.0012 },
      { lat: 46.874, lng: -114.0083 },
      { lat: 46.8862, lng: -114.0174 },
    ],
    timeline: [
      { minutes: 0, lat: 46.8721, lng: -114.0012 },
      { minutes: 10, lat: 46.874, lng: -114.0083 },
      { minutes: 20, lat: 46.88, lng: -114.01 },
      { minutes: 25, lat: 46.8862, lng: -114.0174 },
    ],
    durationMinutes: 25,
    timed: true,
  },
};

function makeEvent(over: Partial<Event> = {}): Event {
  return { ...(f.events[0] as Event), ...over };
}

function Harness({ event }: { event: Event }) {
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
          <MemoryRouter>
            <NotifyProvider>
              <RouteMapSection event={event} />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

let patches: Array<Record<string, unknown>> = [];
let routeMapReads = 0;

function serve(event: Event) {
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/events/:id/route-map`, () => {
      routeMapReads += 1;
      return HttpResponse.json(ROUTE_MAP);
    }),
    http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      return HttpResponse.json({ ...event, ...body });
    })
  );
}

async function openDialog(event: Event): Promise<HTMLElement> {
  serve(event);
  render(<Harness event={event} />);
  fireEvent.click(screen.getByRole("button", { name: "Configure route map" }));
  const dialog = await screen.findByRole("dialog", { name: "Route map" });
  expect(within(dialog).getByTestId("help-events.detail.route-map-dialog")).toBeInTheDocument();
  if (event.routeId !== null && event.routeId !== undefined) {
    await within(dialog).findByTestId("route-map-preview");
    await waitFor(() => expect(maps.length).toBeGreaterThan(0));
  }
  return dialog;
}

function lastStyleInput() {
  return vi.mocked(eventRouteMapStyle).mock.calls.at(-1)![0];
}

// The preview map's current style is the one the shared call built last.
function expectPreviewInSync() {
  const results = vi.mocked(eventRouteMapStyle).mock.results;
  const built = results.at(-1)!.value as unknown;
  const map = maps.at(-1)!;
  expect(map.styles.at(-1)).toBe(built);
}

async function save(dialog: HTMLElement): Promise<Record<string, unknown>> {
  const before = patches.length;
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(patches.length).toBe(before + 1));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Route map" })).not.toBeInTheDocument()
  );
  return patches.at(-1)!;
}

function pickOption(dialog: HTMLElement, testId: string, option: string) {
  const combo = within(within(dialog).getByTestId(testId)).getByRole("combobox");
  fireEvent.mouseDown(combo);
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
}

function group(dialog: HTMLElement, name: string): HTMLElement {
  return within(dialog).getByRole("region", { name });
}

// The events list the copy picker reads: this event and three others,
// served out of year order.
function serveEvents(event: Event) {
  const other = (id: number, year: number, routeMapConfig: unknown): Event =>
    makeEvent({
      id,
      year,
      name: `Santa Flyover ${year}`,
      routeMapConfig: routeMapConfig as Event["routeMapConfig"],
    });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
      HttpResponse.json({
        items: [
          other(4, 2023, { controls: { terrain: false } }),
          event,
          other(6, 2025, FULL_CONFIG),
          other(5, 2024, null),
        ],
      })
    )
  );
}

async function waitForEnabledCombo(region: HTMLElement): Promise<HTMLElement> {
  const combo = within(region).getByRole("combobox");
  await waitFor(() => expect(combo).not.toHaveAttribute("aria-disabled", "true"));
  return combo;
}

beforeEach(() => {
  maps.length = 0;
  patches = [];
  routeMapReads = 0;
  vi.mocked(eventRouteMapStyle).mockClear();
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  server.resetHandlers();
});

describe("the Route map card", () => {
  it("summarises a null config as all defaults and says nothing of landmarks", () => {
    render(<Harness event={makeEvent({ routeMapConfig: null })} />);
    const card = screen.getByTestId("route-map-card");
    expect(within(card).queryByTestId("route-map-landmarks")).toBeNull();
    expect(card.textContent ?? "").not.toMatch(/landmark|viewpoint/i);
    expect(within(card).getByTestId("route-map-changed")).toHaveTextContent(
      "Every setting is at its default."
    );
    expect(within(card).getByRole("button", { name: "Configure route map" })).toBeInTheDocument();
  });

  it("lists each setting that differs from the default", () => {
    render(
      <Harness
        event={makeEvent({
          routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"],
        })}
      />
    );
    const card = screen.getByTestId("route-map-card");
    const chips = within(within(card).getByTestId("route-map-changed"))
      .getAllByText(/: /)
      .map((c) => c.textContent);
    expect(chips).toEqual([
      "Time labels: Every 10 minutes",
      "Arrows: Off",
      "Arrow size: Large",
      "Route line: Thick",
      "Label size: Small",
      "Fullscreen button: Off",
      "Terrain toggle: Off",
    ]);
  });

  it("never names points of interest, even for a stored pois key", () => {
    render(
      <Harness
        event={makeEvent({
          routeMapConfig: { ...FULL_CONFIG, pois: { kinds: ["park"] } } as unknown as Event["routeMapConfig"],
        })}
      />
    );
    const card = screen.getByTestId("route-map-card");
    expect(card.textContent ?? "").not.toMatch(/points of interest/i);
  });

  it("leaves out a stored value equal to its default", () => {
    render(
      <Harness
        event={makeEvent({
          routeMapConfig: {
            display: { timeLabelIntervalMinutes: 15, arrows: true, routeWidth: "thin" },
            controls: { fullscreen: true },
          } as unknown as Event["routeMapConfig"],
        })}
      />
    );
    const card = screen.getByTestId("route-map-card");
    const changed = within(card).getByTestId("route-map-changed");
    expect(within(changed).getAllByText(/: /).map((c) => c.textContent)).toEqual([
      "Route line: Thin",
    ]);
  });
});

describe("the Route map modal", () => {
  it("previews this event's route over the shared style call with gestures on", async () => {
    const dialog = await openDialog(makeEvent({ routeMapConfig: null }));
    expect(routeMapReads).toBe(1);
    const map = maps.at(-1)!;
    expect(map.options.interactive).toBe(true);
    const input = lastStyleInput();
    expect(input.routeMap.path).toEqual(ROUTE_MAP.routeMap.path);
    expect(input.routeMapConfig).toEqual({});
    expectPreviewInSync();
    // The event's map and its enabled MapLibre theme carrying the light
    // default, with that theme's loaded body.
    const light = f.trackerThemes.find((t) => t.key === "route-light")!;
    expect(input.map).toMatchObject({ id: 1, tilesUrl: f.trackerMaps[0]!.tilesUrl });
    expect(input.theme.overlay).toEqual(light.overlay);
    expect(input.theme.body).toEqual(f.themeStyles["route-light"]);
    const built = maps.at(-1)!.styles.at(-1) as { sources: Record<string, { url?: string }> };
    expect(built.sources.basemap?.url).toBe(`pmtiles://${f.trackerMaps[0]!.tilesUrl}`);
    expect(within(dialog).getByTestId("route-map-preview-fullscreen")).toBeInTheDocument();
    expect(within(dialog).getByTestId("route-map-preview-terrain")).toBeInTheDocument();
  });

  it("previews the theme carrying the dark default when Dark is picked", async () => {
    const dialog = await openDialog(makeEvent({ routeMapConfig: null }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Dark" }));
    const dark = f.trackerThemes.find((t) => t.key === "route-dark")!;
    await waitFor(() => expect(lastStyleInput().theme.overlay).toEqual(dark.overlay));
    await waitFor(() => expect(lastStyleInput().theme.body).toEqual(f.themeStyles["route-dark"]));
    expectPreviewInSync();
  });

  it("shows the one-line hint for an event without a map or a MapLibre theme", async () => {
    const cases: Array<[Partial<Event>, string]> = [
      [{ trackerMapId: null }, NO_MAP_HINT],
      [{ trackerThemeIds: [3] }, NO_THEME_HINT],
    ];
    for (const [over, hint] of cases) {
      serve(makeEvent(over));
      const { unmount } = render(<Harness event={makeEvent({ ...over, routeMapConfig: null })} />);
      fireEvent.click(screen.getByRole("button", { name: "Configure route map" }));
      const dialog = await screen.findByRole("dialog", { name: "Route map" });
      expect(await within(dialog).findByTestId("route-map-preview-hint")).toHaveTextContent(hint);
      expect(within(dialog).queryByTestId("route-map-preview")).not.toBeInTheDocument();
      expect(vi.mocked(eventRouteMapStyle)).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("renders no Viewpoints editor", async () => {
    const dialog = await openDialog(
      makeEvent({
        routeMapConfig: {
          ...FULL_CONFIG,
          landmarks: [{ name: "Caras Park", lat: 46.8703, lng: -113.9958 }],
        } as unknown as Event["routeMapConfig"],
      })
    );
    expect(within(dialog).queryByRole("region", { name: "Viewpoints" })).toBeNull();
    expect(within(dialog).queryByTestId("viewpoints-field")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /add viewpoint/i })).toBeNull();
    expect(within(dialog).queryByText("Caras Park")).toBeNull();
    expect(lastStyleInput().routeMapConfig).toEqual(FULL_CONFIG);
  });

  it("round-trips a full config unchanged", async () => {
    const dialog = await openDialog(
      makeEvent({ routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"] })
    );
    expect(lastStyleInput().routeMapConfig).toEqual(FULL_CONFIG);
    const display = group(dialog, "Display");
    expect(within(within(display).getByTestId("route-map-display-timeLabelIntervalMinutes")).getByRole("combobox")).toHaveTextContent(
      "Every 10 minutes"
    );
    expect(within(display).getByRole("switch", { name: "Arrows" })).not.toBeChecked();
    expect(within(group(dialog, "Controls")).getByRole("switch", { name: "Fullscreen button" })).not.toBeChecked();
    const body = await save(dialog);
    expect(body).toEqual({ routeMapConfig: FULL_CONFIG });
  });

  it("changes the display group alone, and each pick reaches the preview", async () => {
    const dialog = await openDialog(
      makeEvent({ routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"] })
    );
    pickOption(dialog, "route-map-display-routeWidth", "Extra thick");
    expect(lastStyleInput().routeMapConfig.display?.routeWidth).toBe("xthick");
    expectPreviewInSync();
    pickOption(dialog, "route-map-display-timeLabelIntervalMinutes", "Off");
    expect(lastStyleInput().routeMapConfig.display?.timeLabelIntervalMinutes).toBe(0);
    expectPreviewInSync();
    fireEvent.click(within(group(dialog, "Display")).getByRole("switch", { name: "Arrows" }));
    expect(lastStyleInput().routeMapConfig.display?.arrows).toBe(true);
    expectPreviewInSync();
    const body = await save(dialog);
    expect(body).toEqual({
      routeMapConfig: {
        ...FULL_CONFIG,
        display: { ...FULL_CONFIG.display, routeWidth: "xthick", timeLabelIntervalMinutes: 0, arrows: true },
      },
    });
  });

  it("changes the controls group alone", async () => {
    const dialog = await openDialog(
      makeEvent({ routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"] })
    );
    expect(within(dialog).queryByTestId("route-map-preview-fullscreen")).not.toBeInTheDocument();
    fireEvent.click(
      within(group(dialog, "Controls")).getByRole("switch", { name: "Fullscreen button" })
    );
    expect(lastStyleInput().routeMapConfig.controls).toEqual({ fullscreen: true, terrain: false });
    expectPreviewInSync();
    expect(within(dialog).getByTestId("route-map-preview-fullscreen")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("route-map-preview-terrain")).not.toBeInTheDocument();
    const body = await save(dialog);
    expect(body).toEqual({
      routeMapConfig: { ...FULL_CONFIG, controls: { fullscreen: true, terrain: false } },
    });
  });

  it("has no Points of interest editor and points to Site settings for the places", async () => {
    const dialog = await openDialog(makeEvent({ routeMapConfig: null }));
    expect(within(dialog).queryByRole("region", { name: "Points of interest" })).toBeNull();
    expect(within(dialog).queryByTestId("pois-field")).toBeNull();
    expect(within(dialog).queryByRole("radio")).toBeNull();
    const caption = within(group(dialog, "Display")).getByTestId("route-map-places-caption");
    expect(caption).toHaveTextContent("Places are set for every map in Site settings.");
    expect(within(caption).getByRole("link", { name: "Site settings" })).toHaveAttribute(
      "href",
      "/site-settings"
    );
  });

  it("draws the route map places of the site settings draft in the preview", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: {
            ...(f.siteSettingsDraft.data as Record<string, unknown>),
            places: { tracker: { kinds: ["park"] }, routeMap: { kinds: ["hospital", "school"] } },
          },
        })
      )
    );
    await openDialog(makeEvent({ routeMapConfig: null }));
    await waitFor(() => expect(lastStyleInput().poiKinds).toEqual(["hospital", "school"]));
    expectPreviewInSync();
    const body = await save(screen.getByRole("dialog", { name: "Route map" }));
    expect(body).toEqual({ routeMapConfig: null });
  });

  it("draws no places while the site settings draft has none", async () => {
    let settingsReads = 0;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () => {
        settingsReads += 1;
        return HttpResponse.json(f.siteSettingsDraft);
      })
    );
    await openDialog(makeEvent({ routeMapConfig: null }));
    await waitFor(() => expect(settingsReads).toBe(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    for (const call of vi.mocked(eventRouteMapStyle).mock.calls) {
      expect(call[0].poiKinds).toBeUndefined();
    }
  });

  it("shows the built-in defaults while unset, writes a pick, and Default removes it", async () => {
    const dialog = await openDialog(makeEvent({ routeMapConfig: null }));
    const display = group(dialog, "Display");
    const combo = (key: string) =>
      within(within(display).getByTestId(`route-map-display-${key}`)).getByRole("combobox");
    expect(combo("timeLabelIntervalMinutes")).toHaveTextContent("Every 15 minutes");
    expect(combo("arrowSize")).toHaveTextContent("Medium");
    expect(combo("routeWidth")).toHaveTextContent("Normal");
    expect(within(display).getByRole("switch", { name: "Arrows" })).toBeChecked();
    expect(within(display).queryByRole("button", { name: /^Default / })).not.toBeInTheDocument();

    pickOption(dialog, "route-map-display-arrowSize", "Small");
    expect(combo("arrowSize")).toHaveTextContent("Small");
    expect(lastStyleInput().routeMapConfig).toEqual({ display: { arrowSize: "small" } });
    fireEvent.click(within(display).getByRole("button", { name: "Default Arrow size" }));
    expect(combo("arrowSize")).toHaveTextContent("Medium");
    expect(lastStyleInput().routeMapConfig).toEqual({});

    const body = await save(dialog);
    expect(body).toEqual({ routeMapConfig: null });
  });

  it("shows Label size as Medium until picked, passes the mapped scale to the preview, and saves the pick", async () => {
    const dialog = await openDialog(makeEvent({ routeMapConfig: null }));
    const display = group(dialog, "Display");
    const combo = within(within(display).getByTestId("route-map-display-labelSize")).getByRole(
      "combobox"
    );
    expect(combo).toHaveTextContent("Medium");
    expect(
      within(display).getByText("How big the time labels and viewpoint names are drawn.")
    ).toBeInTheDocument();
    const lastScale = () => resolveRouteMapConfig(lastStyleInput().routeMapConfig).labelScale;
    expect(lastScale()).toBe(1);

    pickOption(dialog, "route-map-display-labelSize", "Large");
    expect(combo).toHaveTextContent("Large");
    expect(lastStyleInput().routeMapConfig).toEqual({ display: { labelSize: "large" } });
    expect(lastScale()).toBe(1.3);
    expectPreviewInSync();
    pickOption(dialog, "route-map-display-labelSize", "Small");
    expect(lastScale()).toBe(0.8);
    expectPreviewInSync();

    const body = await save(dialog);
    expect(body).toEqual({ routeMapConfig: { display: { labelSize: "small" } } });
  });

  it("draws a stored label size at its scale in the preview", async () => {
    await openDialog(
      makeEvent({ routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"] })
    );
    expect(resolveRouteMapConfig(lastStyleInput().routeMapConfig).labelScale).toBe(0.8);
    const style = maps.at(-1)!.styles.at(-1) as { layers: { id: string; layout?: Record<string, unknown> }[] };
    const timeLabels = style.layers.find((l) => l.id === TIME_LABELS_LAYER);
    expect(timeLabels?.layout?.["text-size"]).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      12,
      10.667,
      16,
      16,
    ]);
  });

  it("reads each control on while absent and writes the flipped value", async () => {
    const dialog = await openDialog(makeEvent({ routeMapConfig: null }));
    const controls = group(dialog, "Controls");
    const fullscreen = within(controls).getByRole("switch", { name: "Fullscreen button" });
    const terrain = within(controls).getByRole("switch", { name: "Terrain toggle" });
    expect(fullscreen).toBeChecked();
    expect(terrain).toBeChecked();
    fireEvent.click(terrain);
    expect(terrain).not.toBeChecked();
    expect(lastStyleInput().routeMapConfig).toEqual({ controls: { terrain: false } });
    expect(within(dialog).queryByTestId("route-map-preview-terrain")).not.toBeInTheDocument();
    fireEvent.click(terrain);
    expect(lastStyleInput().routeMapConfig).toEqual({ controls: { terrain: true } });
    const body = await save(dialog);
    expect(body).toEqual({ routeMapConfig: { controls: { terrain: true } } });
  });

  it("Cancel discards the draft without a request", async () => {
    const event = makeEvent({ routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"] });
    const dialog = await openDialog(event);
    fireEvent.click(
      within(group(dialog, "Controls")).getByRole("switch", { name: "Fullscreen button" })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Route map" })).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Configure route map" }));
    const again = await screen.findByRole("dialog", { name: "Route map" });
    expect(
      within(group(again, "Controls")).getByRole("switch", { name: "Fullscreen button" })
    ).not.toBeChecked();
    expect(patches).toEqual([]);
  });

  it("Clear all asks first, then saves null", async () => {
    const dialog = await openDialog(
      makeEvent({ routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"] })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    let confirm = await screen.findByRole("dialog", { name: "Clear the route map settings?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Clear the route map settings?" })
      ).not.toBeInTheDocument()
    );
    expect(patches).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    confirm = await screen.findByRole("dialog", { name: "Clear the route map settings?" });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole("button", { name: "Clear all" }));
    });
    await waitFor(() => expect(patches).toEqual([{ routeMapConfig: null }]));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Route map" })).not.toBeInTheDocument()
    );
  });

  it("with no linked recording shows the hint, an empty preview, and working controls", async () => {
    const dialog = await openDialog(makeEvent({ routeId: null, routeMapConfig: null }));
    const area = within(dialog).getByTestId("route-map-preview-area");
    expect(within(area).getByTestId("route-map-preview-hint")).toHaveTextContent(
      "Link a flight recording to this event under Flight history to preview its route map."
    );
    expect(within(dialog).queryByTestId("route-map-preview")).not.toBeInTheDocument();
    expect(routeMapReads).toBe(0);
    expect(maps).toHaveLength(0);
    expect(vi.mocked(eventRouteMapStyle)).not.toHaveBeenCalled();
    fireEvent.click(
      within(group(dialog, "Controls")).getByRole("switch", { name: "Fullscreen button" })
    );
    const body = await save(dialog);
    expect(body).toEqual({ routeMapConfig: { controls: { fullscreen: false } } });
  });

  it("Copy from another event lists the others newest year first with a config marked", async () => {
    const event = makeEvent({ id: 7, year: 2026, routeMapConfig: null });
    serveEvents(event);
    const dialog = await openDialog(event);
    const copy = group(dialog, "Copy from another event");
    fireEvent.mouseDown(await waitForEnabledCombo(copy));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((o) => o.getAttribute("data-testid"))).toEqual([
      "route-map-copy-option-6",
      "route-map-copy-option-5",
      "route-map-copy-option-4",
    ]);
    expect(options[0]).toHaveTextContent("2025 Santa Flyover 2025");
    expect(options[0]).toHaveTextContent("Has route map settings");
    expect(options[1]).toHaveTextContent("No route map settings");
    expect(options[2]).toHaveTextContent("2023 Santa Flyover 2023");
    expect(options[2]).toHaveTextContent("Has route map settings");
  });

  it("Copy from another event loads the config into the editors without writing, and Save persists it", async () => {
    const event = makeEvent({ id: 7, year: 2026, routeMapConfig: null });
    serveEvents(event);
    const dialog = await openDialog(event);
    const copy = group(dialog, "Copy from another event");
    fireEvent.mouseDown(await waitForEnabledCombo(copy));
    fireEvent.click(within(screen.getByRole("listbox")).getByTestId("route-map-copy-option-6"));
    expect(within(copy).getByTestId("route-map-copy-loaded")).toHaveTextContent(
      "Loaded the route map settings of Santa Flyover 2025. Review them, then Save to keep them."
    );

    const display = group(dialog, "Display");
    expect(
      within(within(display).getByTestId("route-map-display-timeLabelIntervalMinutes")).getByRole("combobox")
    ).toHaveTextContent("Every 10 minutes");
    expect(within(display).getByRole("switch", { name: "Arrows" })).not.toBeChecked();
    expect(within(group(dialog, "Controls")).getByRole("switch", { name: "Terrain toggle" })).not.toBeChecked();
    expect(within(group(dialog, "Controls")).getByRole("switch", { name: "Fullscreen button" })).not.toBeChecked();
    expect(lastStyleInput().routeMapConfig).toEqual(FULL_CONFIG);
    expectPreviewInSync();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(patches).toEqual([]);

    const body = await save(dialog);
    expect(body).toEqual({ routeMapConfig: FULL_CONFIG });
  });

  it("copying an event with no config resets the draft to the defaults", async () => {
    const event = makeEvent({
      id: 7,
      year: 2026,
      routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"],
    });
    serveEvents(event);
    const dialog = await openDialog(event);
    const copy = group(dialog, "Copy from another event");
    fireEvent.mouseDown(await waitForEnabledCombo(copy));
    fireEvent.click(within(screen.getByRole("listbox")).getByTestId("route-map-copy-option-5"));
    expect(within(copy).getByTestId("route-map-copy-loaded")).toHaveTextContent(
      "Santa Flyover 2024 has no route map settings"
    );
    expect(within(group(dialog, "Controls")).getByRole("switch", { name: "Terrain toggle" })).toBeChecked();
    expect(patches).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Route map" })).not.toBeInTheDocument()
    );
    expect(patches).toEqual([]);
  });

  it("the card on a page without a recording says the preview stays empty", () => {
    render(<Harness event={makeEvent({ routeId: null })} />);
    expect(
      screen.getByText("No flight recording is linked, so the preview stays empty until one is.")
    ).toBeInTheDocument();
  });
});
