import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "../../ConfigContext";
import { buildTheme } from "../../theme/theme";
import { testConfig } from "../../test/renderWithProviders";
import { FakeMap, startViewMap } from "../../test/fakeGoogleMap";
import type { Config } from "../../config";
import type { Bbox } from "../bbox/bbox";
import StartViewField from "./StartViewField";
import {
  clampStartView,
  startMinZoom,
  startViewCaption,
  startViewInside,
  toStartView,
  type StartView,
} from "./startView";

vi.mock("../../pages/places/googleMaps", async () => {
  const { FakeMap: Map } = await import("../../test/fakeGoogleMap");
  return {
    loadMaps: vi.fn(async () => ({ Map })),
    loadMarkers: vi.fn(async () => ({})),
    loadPlaces: vi.fn(async () => ({})),
  };
});

const BOX: Bbox = { west: -114.3, south: 46.75, east: -113.8, north: 47.05 };
const SMALL: Bbox = { west: -114.3, south: 46.75, east: -114.0, north: 46.9 };
const VIEW: StartView = { center: { lat: 47.0, lng: -113.9 }, zoom: 11 };

function Harness({
  initial,
  config = testConfig,
}: {
  initial: StartView | null;
  config?: Config;
}) {
  const [value, setValue] = useState<StartView | null>(initial);
  const [bbox, setBbox] = useState<Bbox>(BOX);
  return (
    <Wrap config={config}>
      <StartViewField value={value} onChange={setValue} bbox={bbox} />
      <button onClick={() => setBbox(SMALL)}>Shrink</button>
      <pre data-testid="value">{JSON.stringify(value)}</pre>
    </Wrap>
  );
}

function Wrap({ config, children }: { config: Config; children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <ConfigProvider config={config}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

function stored(): unknown {
  return JSON.parse(screen.getByTestId("value").textContent ?? "null");
}

async function loadedMap(): Promise<FakeMap> {
  await waitFor(() => expect(startViewMap()).toBeDefined());
  const map = startViewMap()!;
  await waitFor(() => expect(map.options.restriction).toBeDefined());
  return map;
}

beforeEach(() => {
  FakeMap.instances.length = 0;
});

describe("StartViewField (admin.md 6.3, 6.29)", () => {
  it("restricts the map to the box, fits the whole box without a view, and shows the help", async () => {
    render(<Harness initial={null} />);
    const map = await loadedMap();
    expect(map.options.restriction).toEqual({
      latLngBounds: { north: 47.05, south: 46.75, east: -113.8, west: -114.3 },
      strictBounds: true,
    });
    expect(map.options.minZoom).toBe(startMinZoom(BOX, 300, 300));
    expect(map.fitted.at(-1)).toEqual({ north: 47.05, south: 46.75, east: -113.8, west: -114.3 });
    expect(screen.getByTestId("start-view-caption")).toHaveTextContent(
      "Whole area: the tracker opens showing the whole box."
    );
    expect(screen.getByRole("button", { name: "Use whole area" })).toBeDisabled();
    expect(screen.getByTestId("help-events.detail.tracker-map.start-view")).toBeInTheDocument();
    // The map's own fitting writes nothing.
    act(() => map.fire("idle"));
    expect(stored()).toBeNull();
  });

  it("writes the centre to five decimals and the integer zoom when the admin moves the map", async () => {
    render(<Harness initial={null} />);
    const map = await loadedMap();
    act(() => map.pan({ lat: 46.912345678, lng: -114.012345678 }, 12.6));
    expect(stored()).toEqual({ center: { lat: 46.91235, lng: -114.01235 }, zoom: 13 });
    expect(screen.getByTestId("start-view-caption")).toHaveTextContent(
      "Centre 46.91235, -114.01235 at zoom 13"
    );
  });

  it("opens on the stored view, and Use whole area clears it and fits the box", async () => {
    render(<Harness initial={VIEW} />);
    const map = await loadedMap();
    expect(map.center).toEqual(VIEW.center);
    expect(map.zoom).toBe(11);
    fireEvent.click(screen.getByRole("button", { name: "Use whole area" }));
    expect(stored()).toBeNull();
    expect(map.fitted.at(-1)).toEqual({ north: 47.05, south: 46.75, east: -113.8, west: -114.3 });
    // The idle after the fit leaves the value cleared.
    act(() => map.fire("idle"));
    expect(stored()).toBeNull();
  });

  it("a box change that strands the centre moves it inside and says so", async () => {
    render(<Harness initial={VIEW} />);
    await loadedMap();
    expect(screen.queryByTestId("start-view-moved")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Shrink" }));
    expect(stored()).toEqual({ center: { lat: 46.9, lng: -114.0 }, zoom: 11 });
    expect(screen.getByTestId("start-view-moved")).toHaveTextContent(
      "Start view moved inside the new area"
    );
    // The admin can clear it, and the line goes.
    fireEvent.click(screen.getByRole("button", { name: "Use whole area" }));
    expect(stored()).toBeNull();
    expect(screen.queryByTestId("start-view-moved")).toBeNull();
  });

  it("a box change that keeps the centre inside leaves the view alone", async () => {
    const inside: StartView = { center: { lat: 46.8, lng: -114.2 }, zoom: 10 };
    render(<Harness initial={inside} />);
    fireEvent.click(screen.getByRole("button", { name: "Shrink" }));
    expect(stored()).toEqual(inside);
    expect(screen.queryByTestId("start-view-moved")).toBeNull();
  });

  it("without the Maps key shows a note, the caption, and Use whole area", () => {
    render(<Harness initial={VIEW} config={{ ...testConfig, googleMapsKey: "" }} />);
    expect(screen.queryByTestId("start-view-map")).toBeNull();
    expect(screen.getByTestId("start-view-note")).toBeInTheDocument();
    expect(screen.getByTestId("start-view-caption")).toHaveTextContent(
      "Centre 47.00000, -113.90000 at zoom 11"
    );
    fireEvent.click(screen.getByRole("button", { name: "Use whole area" }));
    expect(stored()).toBeNull();
  });

  it("shows a server error under the field", () => {
    render(
      <Wrap config={testConfig}>
        <StartViewField
          value={VIEW}
          onChange={() => undefined}
          bbox={BOX}
          error="must lie inside trackerBbox"
        />
      </Wrap>
    );
    expect(screen.getByTestId("start-view-error")).toHaveTextContent("must lie inside trackerBbox");
  });
});

describe("startView helpers", () => {
  it("reads an API view, numbers as strings included, and null for none", () => {
    expect(toStartView({ center: { lat: "47", lng: "-114" }, zoom: "9" })).toEqual({
      center: { lat: 47, lng: -114 },
      zoom: 9,
    });
    expect(toStartView(null)).toBeNull();
    expect(toStartView({ zoom: 9 })).toBeNull();
  });

  it("checks and clamps the centre against the box", () => {
    expect(startViewInside(VIEW, BOX)).toBe(true);
    expect(startViewInside(VIEW, SMALL)).toBe(false);
    expect(clampStartView(VIEW, SMALL)).toEqual({ center: { lat: 46.9, lng: -114 }, zoom: 11 });
  });

  it("keeps the minimum zoom between 3 and 18", () => {
    expect(startMinZoom({ west: -180, south: -80, east: 180, north: 80 }, 300, 300)).toBe(3);
    expect(startMinZoom({ west: 0, south: 0, east: 0.0001, north: 0.0001 }, 300, 300)).toBe(18);
  });

  it("captions the whole area or the centre and zoom", () => {
    expect(startViewCaption(null)).toMatch(/whole box/);
    expect(startViewCaption(VIEW)).toBe("Centre 47.00000, -113.90000 at zoom 11");
  });
});
