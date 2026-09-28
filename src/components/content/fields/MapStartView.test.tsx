import { describe, expect, it, vi, beforeEach } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { ConfigProvider } from "../../../ConfigContext";
import type { Config } from "../../../config";
import { buildTheme } from "../../../theme/theme";
import type { ReactNode } from "react";

interface FakeMapOpts {
  center: { lat: number; lng: number };
  zoom: number;
}

interface FakeMap {
  center: { lat: number; lng: number };
  zoom: number;
  listeners: Record<string, () => void>;
  addListener(event: string, cb: () => void): { remove: () => void };
  getCenter(): { lat: () => number; lng: () => number };
  getZoom(): number;
  setCenter(c: { lat: number; lng: number }): void;
  setZoom(z: number): void;
}

function createFakeMap(opts: FakeMapOpts): FakeMap {
  const state: FakeMap = {
    center: { ...opts.center },
    zoom: opts.zoom,
    listeners: {},
    addListener(event, cb) {
      state.listeners[event] = cb;
      return {
        remove: () => {
          delete state.listeners[event];
        },
      };
    },
    getCenter() {
      return {
        lat: () => state.center.lat,
        lng: () => state.center.lng,
      };
    },
    getZoom() {
      return state.zoom;
    },
    setCenter(c) {
      state.center = { ...c };
    },
    setZoom(z) {
      state.zoom = z;
    },
  };
  return state;
}

let lastMap: FakeMap | null = null;
let loadMapsBehaviour: "ok" | "fail" = "ok";

class FakeMapCtor {
  constructor(_div: HTMLElement, opts: FakeMapOpts) {
    const m = createFakeMap(opts);
    lastMap = m;
    return m as unknown as FakeMapCtor;
  }
}

vi.mock("../../../pages/places/googleMaps", () => ({
  loadMaps: vi.fn(async () => {
    if (loadMapsBehaviour === "fail") {
      throw new Error("Maps refused to load");
    }
    return { Map: FakeMapCtor } as unknown as google.maps.MapsLibrary;
  }),
  loadMarkers: vi.fn(async () => ({})),
  loadPlaces: vi.fn(async () => ({})),
}));

import MapStartView, { type MapStart } from "./MapStartView";

const KEY_CONFIG: Config = {
  env: "dev",
  apiBaseUrl: "https://api.test",
  cdnBaseUrl: "https://cdn.test",
  siteBaseUrl: "https://site.test",
  cognitoAuthority: "https://cognito.test/pool",
  cognitoDomain: "https://auth.test",
  cognitoClientId: "client-test",
  googleMapsKey: "test-maps-key",
  routeBasemapUrl: "https://basemap.test",
};

const NO_KEY_CONFIG: Config = { ...KEY_CONFIG, googleMapsKey: "" };

function Providers({
  config,
  children,
}: {
  config: Config;
  children: ReactNode;
}) {
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <ConfigProvider config={config}>{children}</ConfigProvider>
    </ThemeProvider>
  );
}

function Controlled({ initial }: { initial: MapStart }) {
  const [value, setValue] = useState<MapStart>(initial);
  return (
    <>
      <MapStartView value={value} onChange={setValue} />
      <input
        aria-label="lat-input"
        value={value.defaultCenter.lat}
        onChange={(e) =>
          setValue({
            ...value,
            defaultCenter: {
              ...value.defaultCenter,
              lat: Number(e.target.value),
            },
          })
        }
      />
      <input
        aria-label="lng-input"
        value={value.defaultCenter.lng}
        onChange={(e) =>
          setValue({
            ...value,
            defaultCenter: {
              ...value.defaultCenter,
              lng: Number(e.target.value),
            },
          })
        }
      />
      <input
        aria-label="zoom-input"
        value={value.defaultZoom}
        onChange={(e) =>
          setValue({ ...value, defaultZoom: Number(e.target.value) })
        }
      />
      <pre data-testid="value">{JSON.stringify(value)}</pre>
    </>
  );
}

beforeEach(() => {
  lastMap = null;
  loadMapsBehaviour = "ok";
});

const INITIAL: MapStart = {
  defaultCenter: { lat: 46.87, lng: -114 },
  defaultZoom: 11,
};

describe("MapStartView (admin.md 6.14)", () => {
  it("renders the map when the Maps key is set", async () => {
    render(
      <Providers config={KEY_CONFIG}>
        <Controlled initial={INITIAL} />
      </Providers>,
    );
    await screen.findByTestId("map-start-view");
    expect(lastMap).not.toBeNull();
    expect(lastMap!.center).toEqual({ lat: 46.87, lng: -114 });
    expect(lastMap!.zoom).toBe(11);
  });

  it("writes rounded centre and integer zoom when the map idles", async () => {
    render(
      <Providers config={KEY_CONFIG}>
        <Controlled initial={INITIAL} />
      </Providers>,
    );
    await screen.findByTestId("map-start-view");
    act(() => {
      lastMap!.center = { lat: 47.123456789, lng: -114.987654321 };
      lastMap!.zoom = 13.6;
      lastMap!.listeners.idle?.();
    });
    const stored = JSON.parse(screen.getByTestId("value").textContent ?? "{}");
    expect(stored).toEqual({
      defaultCenter: { lat: 47.12346, lng: -114.98765 },
      defaultZoom: 14,
    });
  });

  it("moves the map when the number fields are edited", async () => {
    render(
      <Providers config={KEY_CONFIG}>
        <Controlled initial={INITIAL} />
      </Providers>,
    );
    await screen.findByTestId("map-start-view");
    const lat = screen.getByLabelText("lat-input");
    const lng = screen.getByLabelText("lng-input");
    const zoom = screen.getByLabelText("zoom-input");
    fireEvent.change(lat, { target: { value: "40.5" } });
    fireEvent.change(lng, { target: { value: "-100.25" } });
    fireEvent.change(zoom, { target: { value: "9" } });
    expect(lastMap!.center).toEqual({ lat: 40.5, lng: -100.25 });
    expect(lastMap!.zoom).toBe(9);
    const stored = JSON.parse(screen.getByTestId("value").textContent ?? "{}");
    expect(stored).toEqual({
      defaultCenter: { lat: 40.5, lng: -100.25 },
      defaultZoom: 9,
    });
  });

  it("shows the note and no map when the Maps key is missing", () => {
    render(
      <Providers config={NO_KEY_CONFIG}>
        <Controlled initial={INITIAL} />
      </Providers>,
    );
    expect(screen.queryByTestId("map-start-view")).toBeNull();
    expect(screen.getByTestId("map-start-view-note")).toBeInTheDocument();
  });

  it("shows a warning and no map when the loader fails", async () => {
    loadMapsBehaviour = "fail";
    render(
      <Providers config={KEY_CONFIG}>
        <Controlled initial={INITIAL} />
      </Providers>,
    );
    const note = await screen.findByTestId("map-start-view-note");
    expect(note.textContent).toContain("Maps refused to load");
    expect(screen.queryByTestId("map-start-view")).toBeNull();
  });
});
