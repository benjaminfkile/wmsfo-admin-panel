import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import RouteMapConfigDialog from "./RouteMapConfigDialog";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import type { Event } from "../../api/types";
import type { RouteMapConfigValue } from "../../routeMap/eventRouteMap";
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

// The site route the dialog previews.
const ROUTE_ID = 4;

function makeEvent(over: Partial<Event> = {}): Event {
  return { ...(f.events[0] as Event), ...over };
}

// Stands in for the Route card: holds the draft's `mapConfig`, opens the
// dialog over it, and records every config the dialog hands back.
function DialogHost({ initial, places }: { initial: unknown; places?: unknown }) {
  const [mapConfig, setMapConfig] = useState<unknown>(initial);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Configure route map
      </button>
      {open ? (
        <RouteMapConfigDialog
          routeId={ROUTE_ID}
          mapConfig={mapConfig}
          places={places}
          onSave={(next: RouteMapConfigValue | null) => {
            saves.push({ mapConfig: next });
            setMapConfig(next);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function Harness({ config = null, places }: { config?: unknown; places?: unknown }) {
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
              <DialogHost initial={config} places={places} />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

let saves: Array<Record<string, unknown>> = [];
let routeMapReads = 0;
let routeMapIds: number[] = [];

function serve(routeMap: Record<string, unknown> = ROUTE_MAP) {
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/routes/:id/route-map`, ({ params }) => {
      routeMapReads += 1;
      routeMapIds.push(Number(params.id));
      return HttpResponse.json(routeMap);
    })
  );
}

const DIALOG = "Route map settings";

async function openDialog(config: unknown, places?: unknown): Promise<HTMLElement> {
  serve();
  render(<Harness config={config} places={places} />);
  fireEvent.click(screen.getByRole("button", { name: "Configure route map" }));
  const dialog = await screen.findByRole("dialog", { name: DIALOG });
  expect(within(dialog).getByTestId("help-site-settings.route")).toBeInTheDocument();
  await within(dialog).findByTestId("route-map-preview");
  await waitFor(() => expect(maps.length).toBeGreaterThan(0));
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
  const before = saves.length;
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(saves.length).toBe(before + 1));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: DIALOG })).not.toBeInTheDocument()
  );
  return saves.at(-1)!;
}

function pickOption(dialog: HTMLElement, testId: string, option: string) {
  const combo = within(within(dialog).getByTestId(testId)).getByRole("combobox");
  fireEvent.mouseDown(combo);
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
}

function group(dialog: HTMLElement, name: string): HTMLElement {
  return within(dialog).getByRole("region", { name });
}

beforeEach(() => {
  maps.length = 0;
  saves = [];
  routeMapReads = 0;
  routeMapIds = [];
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

describe("the Route map settings dialog", () => {
  it("previews the site route over the shared style call with gestures on", async () => {
    const dialog = await openDialog(null);
    expect(routeMapReads).toBe(1);
    expect(routeMapIds).toEqual([ROUTE_ID]);
    const map = maps.at(-1)!;
    expect(map.options.interactive).toBe(true);
    const input = lastStyleInput();
    expect(input.routeMap.path).toEqual(ROUTE_MAP.routeMap.path);
    expect(input.routeMapConfig).toEqual({});
    expectPreviewInSync();
    // The current event's map and its enabled MapLibre theme carrying the
    // light default, with that theme's loaded body.
    const light = f.trackerThemes.find((t) => t.key === "light")!;
    expect(input.map).toMatchObject({ id: 1, tilesUrl: f.trackerMaps[0]!.tilesUrl });
    expect(input.theme.overlay).toEqual(light.overlay);
    expect(input.theme.body).toEqual(f.themeStyles.light);
    const built = maps.at(-1)!.styles.at(-1) as { sources: Record<string, { url?: string }> };
    expect(built.sources.basemap?.url).toBe(`pmtiles://${f.trackerMaps[0]!.tilesUrl}`);
    expect(within(dialog).getByTestId("route-map-preview-fullscreen")).toBeInTheDocument();
    expect(within(dialog).getByTestId("route-map-preview-terrain")).toBeInTheDocument();
  });

  it("previews the theme carrying the dark default when Dark is picked", async () => {
    const dialog = await openDialog(null);
    fireEvent.click(within(dialog).getByRole("button", { name: "Dark" }));
    const dark = f.trackerThemes.find((t) => t.key === "dark")!;
    await waitFor(() => expect(lastStyleInput().theme.overlay).toEqual(dark.overlay));
    await waitFor(() => expect(lastStyleInput().theme.body).toEqual(f.themeStyles.dark));
    expectPreviewInSync();
  });

  it("shows the one-line hint when the route view's event has no map or no MapLibre theme", async () => {
    const cases: Array<[Event[], string]> = [
      [[makeEvent({ trackerMapId: null })], NO_MAP_HINT],
      [[makeEvent({ trackerThemeIds: [3] })], NO_THEME_HINT],
      [[], NO_MAP_HINT],
    ];
    for (const [items, hint] of cases) {
      serve();
      server.use(
        http.get(`${testConfig.apiBaseUrl}/admin/events`, () => HttpResponse.json({ items }))
      );
      const { unmount } = render(<Harness />);
      fireEvent.click(screen.getByRole("button", { name: "Configure route map" }));
      const dialog = await screen.findByRole("dialog", { name: DIALOG });
      expect(await within(dialog).findByTestId("route-map-preview-hint")).toHaveTextContent(hint);
      expect(within(dialog).queryByTestId("route-map-preview")).not.toBeInTheDocument();
      expect(vi.mocked(eventRouteMapStyle)).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("draws over the newest event's map when no event is current", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
        HttpResponse.json({
          items: [
            makeEvent({ id: 5, year: 2024, isCurrent: false, trackerMapId: null }),
            makeEvent({ id: 6, year: 2025, isCurrent: false }),
          ],
        })
      )
    );
    await openDialog(null);
    expect(lastStyleInput().map).toMatchObject({ id: 1 });
  });

  it("renders no Viewpoints editor", async () => {
    const dialog = await openDialog({
      ...FULL_CONFIG,
      landmarks: [{ name: "Caras Park", lat: 46.8703, lng: -113.9958 }],
    });
    expect(within(dialog).queryByRole("region", { name: "Viewpoints" })).toBeNull();
    expect(within(dialog).queryByTestId("viewpoints-field")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /add viewpoint/i })).toBeNull();
    expect(within(dialog).queryByText("Caras Park")).toBeNull();
    expect(lastStyleInput().routeMapConfig).toEqual(FULL_CONFIG);
  });

  it("round-trips a full config unchanged", async () => {
    const dialog = await openDialog(FULL_CONFIG);
    expect(lastStyleInput().routeMapConfig).toEqual(FULL_CONFIG);
    const display = group(dialog, "Display");
    expect(within(within(display).getByTestId("route-map-display-timeLabelIntervalMinutes")).getByRole("combobox")).toHaveTextContent(
      "Every 10 minutes"
    );
    expect(within(display).getByRole("switch", { name: "Arrows" })).not.toBeChecked();
    expect(within(group(dialog, "Controls")).getByRole("switch", { name: "Fullscreen button" })).not.toBeChecked();
    const body = await save(dialog);
    expect(body).toEqual({ mapConfig: FULL_CONFIG });
  });

  it("changes the display group alone, and each pick reaches the preview", async () => {
    const dialog = await openDialog(FULL_CONFIG);
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
      mapConfig: {
        ...FULL_CONFIG,
        display: { ...FULL_CONFIG.display, routeWidth: "xthick", timeLabelIntervalMinutes: 0, arrows: true },
      },
    });
  });

  it("changes the controls group alone", async () => {
    const dialog = await openDialog(FULL_CONFIG);
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
      mapConfig: { ...FULL_CONFIG, controls: { fullscreen: true, terrain: false } },
    });
  });

  it("has no Points of interest editor and points to Site settings for the places", async () => {
    const dialog = await openDialog(null);
    expect(within(dialog).queryByRole("region", { name: "Points of interest" })).toBeNull();
    expect(within(dialog).queryByTestId("pois-field")).toBeNull();
    expect(within(dialog).queryByRole("radio")).toBeNull();
    const caption = within(group(dialog, "Display")).getByTestId("route-map-places-caption");
    expect(caption).toHaveTextContent(
      "Places are set for every map under Places on the maps in Site settings."
    );
    expect(within(caption).getByRole("link", { name: "Site settings" })).toHaveAttribute(
      "href",
      "/site-settings"
    );
  });

  it("draws the route map places of the site settings draft in the preview", async () => {
    await openDialog(null, {
      tracker: { kinds: ["park"] },
      routeMap: { kinds: ["hospital", "school"] },
    });
    await waitFor(() => expect(lastStyleInput().poiKinds).toEqual(["hospital", "school"]));
    expectPreviewInSync();
    const body = await save(screen.getByRole("dialog", { name: DIALOG }));
    expect(body).toEqual({ mapConfig: null });
  });

  it("draws no places while the site settings draft has none", async () => {
    await openDialog(null);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    for (const call of vi.mocked(eventRouteMapStyle).mock.calls) {
      expect(call[0].poiKinds).toBeUndefined();
    }
  });

  it("shows the built-in defaults while unset, writes a pick, and Default removes it", async () => {
    const dialog = await openDialog(null);
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
    expect(body).toEqual({ mapConfig: null });
  });

  it("shows Label size as Medium until picked, passes the mapped scale to the preview, and saves the pick", async () => {
    const dialog = await openDialog(null);
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
    expect(body).toEqual({ mapConfig: { display: { labelSize: "small" } } });
  });

  it("draws a stored label size at its scale in the preview", async () => {
    await openDialog(FULL_CONFIG);
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
    const dialog = await openDialog(null);
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
    expect(body).toEqual({ mapConfig: { controls: { terrain: true } } });
  });

  it("Cancel discards the draft and writes nothing", async () => {
    const dialog = await openDialog(FULL_CONFIG);
    fireEvent.click(
      within(group(dialog, "Controls")).getByRole("switch", { name: "Fullscreen button" })
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: DIALOG })).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Configure route map" }));
    const again = await screen.findByRole("dialog", { name: DIALOG });
    expect(
      within(group(again, "Controls")).getByRole("switch", { name: "Fullscreen button" })
    ).not.toBeChecked();
    expect(saves).toEqual([]);
  });

  it("Clear all asks first, then writes null", async () => {
    const dialog = await openDialog(FULL_CONFIG);
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    let confirm = await screen.findByRole("dialog", { name: "Clear the route map settings?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Clear the route map settings?" })
      ).not.toBeInTheDocument()
    );
    expect(saves).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    confirm = await screen.findByRole("dialog", { name: "Clear the route map settings?" });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole("button", { name: "Clear all" }));
    });
    await waitFor(() => expect(saves).toEqual([{ mapConfig: null }]));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: DIALOG })).not.toBeInTheDocument()
    );
  });

  it("with a route without a path shows the hint, an empty preview, and working controls", async () => {
    serve({ routeMap: null });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Configure route map" }));
    const dialog = await screen.findByRole("dialog", { name: DIALOG });
    const area = within(dialog).getByTestId("route-map-preview-area");
    expect(await within(area).findByTestId("route-map-preview-hint")).toHaveTextContent(
      "The site route has no path to draw."
    );
    expect(within(dialog).queryByTestId("route-map-preview")).not.toBeInTheDocument();
    expect(maps).toHaveLength(0);
    expect(vi.mocked(eventRouteMapStyle)).not.toHaveBeenCalled();
    fireEvent.click(
      within(group(dialog, "Controls")).getByRole("switch", { name: "Fullscreen button" })
    );
    const body = await save(dialog);
    expect(body).toEqual({ mapConfig: { controls: { fullscreen: false } } });
  });

  it("offers no Copy from another event", async () => {
    const dialog = await openDialog(null);
    expect(within(dialog).queryByRole("region", { name: "Copy from another event" })).toBeNull();
    expect(within(dialog).queryByTestId("route-map-copy-loaded")).toBeNull();
  });




});
