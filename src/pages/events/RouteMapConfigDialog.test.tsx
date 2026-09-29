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
import { eventRouteMapStyle } from "../../routeMap/eventRouteMap";
import { kindsFor } from "../../components/content/routePreviewPois";

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
  },
  controls: { fullscreen: false, terrain: false },
  landmarks: [
    {
      name: "Caras Park",
      lat: 46.8703,
      lng: -113.9958,
      icon: { source: "library", id: "tree" },
      description: "The downtown tree lighting starts here.",
    },
    { name: "Fort Missoula", lat: 46.8455, lng: -114.0569 },
  ],
  pois: { kinds: ["hospital", "park"] },
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
  if (event.routeId !== null && event.routeId !== undefined) {
    await within(dialog).findByTestId("route-map-preview");
    await waitFor(() => expect(maps.length).toBeGreaterThan(0));
  }
  return dialog;
}

function lastStyleInput() {
  return vi.mocked(eventRouteMapStyle).mock.calls.at(-1)![1];
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
  it("summarises a null config as all defaults with no landmarks", () => {
    render(<Harness event={makeEvent({ routeMapConfig: null })} />);
    const card = screen.getByTestId("route-map-card");
    expect(within(card).getByTestId("route-map-landmarks")).toHaveTextContent("No landmarks");
    expect(within(card).getByTestId("route-map-changed")).toHaveTextContent(
      "Every setting is at its default."
    );
    expect(within(card).getByRole("button", { name: "Configure route map" })).toBeInTheDocument();
  });

  it("counts the landmarks and lists each setting that differs from the default", () => {
    render(
      <Harness
        event={makeEvent({
          routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"],
        })}
      />
    );
    const card = screen.getByTestId("route-map-card");
    expect(within(card).getByTestId("route-map-landmarks")).toHaveTextContent("2 landmarks");
    const chips = within(within(card).getByTestId("route-map-changed"))
      .getAllByText(/: /)
      .map((c) => c.textContent);
    expect(chips).toEqual([
      "Time labels: Every 10 minutes",
      "Arrows: Off",
      "Arrow size: Large",
      "Route line: Thick",
      "Fullscreen button: Off",
      "Terrain toggle: Off",
      "Points of interest: Custom",
    ]);
  });

  it("leaves out a stored value equal to its default", () => {
    render(
      <Harness
        event={makeEvent({
          routeMapConfig: {
            display: { timeLabelIntervalMinutes: 15, arrows: true, routeWidth: "thin" },
            controls: { fullscreen: true },
            landmarks: [{ name: "Solo", lat: 1, lng: 2 }],
          } as unknown as Event["routeMapConfig"],
        })}
      />
    );
    const card = screen.getByTestId("route-map-card");
    expect(within(card).getByTestId("route-map-landmarks")).toHaveTextContent("1 landmark");
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
    expect(within(dialog).getByTestId("route-map-preview-fullscreen")).toBeInTheDocument();
    expect(within(dialog).getByTestId("route-map-preview-terrain")).toBeInTheDocument();
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
    expect(within(group(dialog, "Landmarks")).getByText("Caras Park")).toBeInTheDocument();
    expect(within(group(dialog, "Points of interest")).getByRole("radio", { name: "Custom" })).toBeChecked();
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

  it("changes the landmarks group alone", async () => {
    const dialog = await openDialog(
      makeEvent({ routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"] })
    );
    const landmarks = group(dialog, "Landmarks");
    fireEvent.click(within(landmarks).getByRole("button", { name: "Delete Fort Missoula" }));
    expect(lastStyleInput().routeMapConfig.landmarks).toEqual([FULL_CONFIG.landmarks[0]]);
    expectPreviewInSync();

    fireEvent.click(within(landmarks).getByRole("button", { name: "Add landmark" }));
    const add = await screen.findByRole("dialog", { name: "Add landmark" });
    fireEvent.change(within(add).getByLabelText("Latitude"), { target: { value: "46.88" } });
    fireEvent.change(within(add).getByLabelText("Longitude"), { target: { value: "-114.01" } });
    fireEvent.change(within(add).getByLabelText("Name"), { target: { value: "  Depot  " } });
    fireEvent.click(within(add).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add landmark" })).not.toBeInTheDocument()
    );
    const added = { name: "Depot", lat: 46.88, lng: -114.01 };
    expect(lastStyleInput().routeMapConfig.landmarks).toEqual([FULL_CONFIG.landmarks[0], added]);
    expectPreviewInSync();

    const body = await save(dialog);
    expect(body).toEqual({
      routeMapConfig: { ...FULL_CONFIG, landmarks: [FULL_CONFIG.landmarks[0], added] },
    });
  });

  it("changes the points of interest group alone", async () => {
    const dialog = await openDialog(
      makeEvent({ routeMapConfig: FULL_CONFIG as unknown as Event["routeMapConfig"] })
    );
    const pois = group(dialog, "Points of interest");
    fireEvent.click(within(pois).getByRole("radio", { name: "Default" }));
    expect(lastStyleInput().routeMapConfig.pois).toBeUndefined();
    expectPreviewInSync();
    fireEvent.click(within(pois).getByRole("radio", { name: "Custom" }));
    fireEvent.click(within(pois).getByRole("checkbox", { name: "Churches" }));
    expect(lastStyleInput().routeMapConfig.pois).toEqual({ kinds: kindsFor(["churches"]) });
    expectPreviewInSync();
    const body = await save(dialog);
    expect(body).toEqual({
      routeMapConfig: { ...FULL_CONFIG, pois: { kinds: kindsFor(["churches"]) } },
    });
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
    fireEvent.click(within(group(dialog, "Landmarks")).getByRole("button", { name: "Delete Caras Park" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Route map" })).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Configure route map" }));
    const again = await screen.findByRole("dialog", { name: "Route map" });
    expect(within(group(again, "Landmarks")).getByText("Caras Park")).toBeInTheDocument();
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

  it("the card on a page without a recording says the preview stays empty", () => {
    render(<Harness event={makeEvent({ routeId: null })} />);
    expect(
      screen.getByText("No flight recording is linked, so the preview stays empty until one is.")
    ).toBeInTheDocument();
  });
});
