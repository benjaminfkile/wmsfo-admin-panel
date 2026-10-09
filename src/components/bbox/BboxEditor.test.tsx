import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { ConfigProvider } from "../../ConfigContext";
import type { Config } from "../../config";
import { NotifyProvider } from "../../hooks/useNotify";
import { buildTheme } from "../../theme/theme";
import { testConfig } from "../../test/renderWithProviders";
import type { Bbox } from "./bbox";

type Point = { lat: number; lng: number };
type Listener = (e?: { latLng: { lat: () => number; lng: () => number } }) => void;

function listen(listeners: Record<string, Listener[]>, name: string, cb: Listener) {
  (listeners[name] ??= []).push(cb);
  return {
    remove: () => {
      listeners[name] = (listeners[name] ?? []).filter((l) => l !== cb);
    },
  };
}

class FakeMap {
  options: Record<string, unknown>;
  fits: Array<{ bounds: unknown; padding: unknown }> = [];
  listeners: Record<string, Listener[]> = {};
  constructor(_div: HTMLElement, options: Record<string, unknown>) {
    this.options = { ...options };
    maps.push(this);
  }
  fitBounds(bounds: unknown, padding: unknown) {
    this.fits.push({ bounds, padding });
  }
  setOptions(o: Record<string, unknown>) {
    Object.assign(this.options, o);
  }
  addListener(name: string, cb: Listener) {
    return listen(this.listeners, name, cb);
  }
  fire(name: string, p: Point) {
    for (const l of this.listeners[name] ?? []) l({ latLng: { lat: () => p.lat, lng: () => p.lng } });
  }
}

class FakeRectangle {
  options: Record<string, unknown>;
  bounds: unknown;
  constructor(options: Record<string, unknown>) {
    this.options = options;
    this.bounds = options.bounds;
    rectangles.push(this);
  }
  setBounds(b: unknown) {
    this.bounds = b;
  }
  setMap() {}
}

class FakePolygon {
  options: Record<string, unknown>;
  paths: Point[][];
  constructor(options: Record<string, unknown>) {
    this.options = options;
    this.paths = options.paths as Point[][];
    polygons.push(this);
  }
  setPaths(p: Point[][]) {
    this.paths = p;
  }
  setMap() {}
}

class FakeMarker {
  options: Record<string, unknown>;
  position: Point;
  listeners: Record<string, Listener[]> = {};
  constructor(options: Record<string, unknown>) {
    this.options = options;
    this.position = options.position as Point;
    markers.push(this);
  }
  setPosition(p: Point) {
    this.position = p;
  }
  getPosition() {
    const p = this.position;
    return { lat: () => p.lat, lng: () => p.lng };
  }
  setMap() {}
  addListener(name: string, cb: Listener) {
    return listen(this.listeners, name, cb);
  }
  drag(p: Point) {
    this.position = p;
    for (const l of this.listeners.drag ?? []) l();
  }
}

let maps: FakeMap[] = [];
let rectangles: FakeRectangle[] = [];
let polygons: FakePolygon[] = [];
let markers: FakeMarker[] = [];
let loadBehaviour: "ok" | "fail" = "ok";

vi.mock("../../pages/places/googleMaps", () => ({
  loadMaps: vi.fn(async () => {
    if (loadBehaviour === "fail") throw new Error("Maps refused to load");
    return { Map: FakeMap, Rectangle: FakeRectangle, Polygon: FakePolygon };
  }),
  loadMarkers: vi.fn(async () => ({ Marker: FakeMarker })),
  loadPlaces: vi.fn(async () => ({})),
}));

import BboxEditor from "./BboxEditor";

const BOX: Bbox = { west: -114.3, south: 46.75, east: -113.8, north: 47.05 };

function Controlled() {
  const [value, setValue] = useState<Bbox>(BOX);
  return (
    <>
      <BboxEditor value={value} onChange={setValue} exportName="Test" />
      <pre data-testid="value">{JSON.stringify(value)}</pre>
    </>
  );
}

function renderEditor(config: Config = testConfig) {
  return render(
    <ThemeProvider theme={buildTheme("light")}>
      <ConfigProvider config={config}>
        <NotifyProvider>
          <Controlled />
        </NotifyProvider>
      </ConfigProvider>
    </ThemeProvider>,
  );
}

function stored(): Bbox {
  return JSON.parse(screen.getByTestId("value").textContent ?? "{}") as Bbox;
}

function handle(corner: string): FakeMarker {
  const m = markers.find((x) => x.options.title === `Drag the ${corner} corner`);
  if (!m) throw new Error(`no ${corner} handle`);
  return m;
}

async function ready() {
  await act(async () => {
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(markers).toHaveLength(4));
}

const boundsOf = (b: Bbox) => ({ north: b.north, south: b.south, east: b.east, west: b.west });

beforeEach(() => {
  maps = [];
  rectangles = [];
  polygons = [];
  markers = [];
  loadBehaviour = "ok";
});

describe("BboxEditor (admin.md 6.29)", () => {
  it("creates the Google map once, fitted to the box, with the outline and handles", async () => {
    renderEditor();
    await ready();
    expect(maps).toHaveLength(1);
    const map = maps[0]!;
    expect(map.options).toMatchObject({
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
    });
    expect(map.fits).toEqual([{ bounds: boundsOf(BOX), padding: 24 }]);
    expect(rectangles).toHaveLength(1);
    expect(rectangles[0]!.options).toMatchObject({
      strokeColor: "#1a56c4",
      strokeWeight: 2,
      fillOpacity: 0,
      editable: false,
      draggable: false,
      clickable: false,
    });
    expect(rectangles[0]!.bounds).toEqual(boundsOf(BOX));
    expect(handle("nw").position).toEqual({ lat: 47.05, lng: -114.3 });
    expect(handle("se").position).toEqual({ lat: 46.75, lng: -113.8 });
    expect(handle("nw").options.draggable).toBe(true);
  });

  it("draws the mask as the world ring with the box ring as a hole", async () => {
    renderEditor();
    await ready();
    const mask = polygons[0]!;
    expect(mask.options).toMatchObject({ fillColor: "#000000", fillOpacity: 0.3, strokeWeight: 0, clickable: false });
    expect(mask.paths).toEqual([
      [
        { lat: 85, lng: -180 },
        { lat: 85, lng: 0 },
        { lat: 85, lng: 180 },
        { lat: -85, lng: 180 },
        { lat: -85, lng: 0 },
        { lat: -85, lng: -180 },
      ],
      [
        { lat: 46.75, lng: -114.3 },
        { lat: 46.75, lng: -113.8 },
        { lat: 47.05, lng: -113.8 },
        { lat: 47.05, lng: -114.3 },
      ],
    ]);
  });

  it("moves the outline, the mask hole, and the two matching handles when a side is typed, and refits", async () => {
    renderEditor();
    await ready();
    fireEvent.change(screen.getByTestId("bbox-west"), { target: { value: "-114.5" } });
    const next = { ...BOX, west: -114.5 };
    expect(stored()).toEqual(next);
    expect(rectangles[0]!.bounds).toEqual(boundsOf(next));
    expect(polygons[0]!.paths[1]).toEqual([
      { lat: 46.75, lng: -114.5 },
      { lat: 46.75, lng: -113.8 },
      { lat: 47.05, lng: -113.8 },
      { lat: 47.05, lng: -114.5 },
    ]);
    expect(handle("nw").position).toEqual({ lat: 47.05, lng: -114.5 });
    expect(handle("sw").position).toEqual({ lat: 46.75, lng: -114.5 });
    expect(handle("ne").position).toEqual({ lat: 47.05, lng: -113.8 });
    expect(maps[0]!.fits.at(-1)).toEqual({ bounds: boundsOf(next), padding: 24 });
  });

  it("dragging the north west handle changes west and north alone, rounded, without a refit", async () => {
    renderEditor();
    await ready();
    const fits = maps[0]!.fits.length;
    act(() => handle("nw").drag({ lat: 47.123456, lng: -114.456789 }));
    expect(stored()).toEqual({ ...BOX, west: -114.4568, north: 47.1235 });
    expect(maps[0]!.fits).toHaveLength(fits);
    expect(screen.getByTestId("bbox-west")).toHaveValue(-114.4568);
  });

  it("with Draw area on, a mousedown, mousemove, mouseup sequence replaces the box", async () => {
    renderEditor();
    await ready();
    const map = maps[0]!;
    fireEvent.click(screen.getByTestId("bbox-draw"));
    expect(map.options.draggable).toBe(false);
    act(() => {
      map.fire("mousedown", { lat: 46.9, lng: -114.1 });
      map.fire("mousemove", { lat: 47.0, lng: -114.2 });
      map.fire("mousemove", { lat: 47.2, lng: -113.55557 });
      map.fire("mouseup", { lat: 47.2, lng: -113.55557 });
    });
    expect(stored()).toEqual({ west: -114.1, south: 46.9, east: -113.5556, north: 47.2 });
    act(() => map.fire("mousemove", { lat: 48, lng: -113 }));
    expect(stored()).toEqual({ west: -114.1, south: 46.9, east: -113.5556, north: 47.2 });
    fireEvent.click(screen.getByTestId("bbox-draw"));
    expect(map.options.draggable).toBe(true);
  });

  it("shows the unset note and creates no map while the Maps key is empty", async () => {
    renderEditor({ ...testConfig, googleMapsKey: "", routeBasemapUrl: "https://basemap.test" });
    expect(screen.getByTestId("bbox-map-note")).toHaveTextContent(
      "The map needs VITE_GOOGLE_MAPS_KEY, which is not set.",
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(maps).toHaveLength(0);
    expect(screen.queryByTestId("bbox-map")).toBeNull();
    expect(screen.getByTestId("bbox-west")).toHaveValue(-114.3);
  });

  it("shows the failed note when the loader rejects", async () => {
    loadBehaviour = "fail";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderEditor({ ...testConfig, routeBasemapUrl: "" });
    expect(await screen.findByTestId("bbox-map-note")).toHaveTextContent("The map could not load.");
    expect(maps).toHaveLength(0);
  });
});
