import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ConfigProvider } from "../../../ConfigContext";
import { buildTheme } from "../../../theme/theme";
import { installClient } from "../../../api/client";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../../test/renderWithProviders";
import {
  MAX_LANDMARK_DESCRIPTION,
  MAX_LANDMARKS,
  landmarksValue,
  type Landmark,
} from "../landmarks";
import { kindsFor } from "../routePreviewPois";

type Handler = (e?: unknown) => void;

interface FakeMarker {
  position: { lat: number; lng: number } | null;
  onMap: boolean;
  listeners: Record<string, Handler>;
}

let clickMap: Handler | null = null;
let lastMarker: FakeMarker | null = null;

function latLng(lat: number, lng: number) {
  return { lat: () => lat, lng: () => lng };
}

class FakeMap {
  addListener(event: string, cb: Handler) {
    if (event === "click") clickMap = cb;
    return { remove: () => undefined };
  }
}

class FakeMarkerCtor {
  constructor() {
    const m: FakeMarker & Record<string, unknown> = {
      position: null,
      onMap: false,
      listeners: {},
    };
    Object.assign(m, {
      setPosition(p: { lat: number; lng: number }) {
        m.position = p;
      },
      getPosition() {
        return m.position ? latLng(m.position.lat, m.position.lng) : null;
      },
      setMap(map: unknown) {
        m.onMap = map !== null;
      },
      addListener(event: string, cb: Handler) {
        m.listeners[event] = cb;
        return { remove: () => undefined };
      },
    });
    lastMarker = m;
    return m as unknown as FakeMarkerCtor;
  }
}

vi.mock("../../../pages/places/googleMaps", () => ({
  loadMaps: vi.fn(async () => ({ Map: FakeMap }) as unknown as google.maps.MapsLibrary),
  loadMarkers: vi.fn(
    async () => ({ Marker: FakeMarkerCtor }) as unknown as google.maps.MarkerLibrary
  ),
  loadPlaces: vi.fn(async () => ({})),
}));

import LandmarksEditor from "./LandmarksEditor";
import PoisEditor from "./PoisEditor";

type RouteValue = {
  landmarks?: Landmark[];
  pois?: { kinds: string[] };
};


function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <ConfigProvider config={testConfig}>
        <QueryClientProvider client={client}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

let latest: RouteValue = {};

function Controlled({ initial }: { initial: RouteValue }) {
  const [value, setValue] = useState<RouteValue>(initial);
  const write = (next: RouteValue) => {
    latest = next;
    setValue(next);
  };
  return (
    <>
      <LandmarksEditor
        value={value.landmarks ?? []}
        onChange={(next) => write({ ...value, landmarks: landmarksValue(next) })}
        title="Landmarks"
        help="Named spots drawn on the route map."
      />
      <PoisEditor
        value={value.pois}
        onChange={(next) => write({ ...value, pois: next })}
        title="Points of interest"
      />
    </>
  );
}

function renderForm(initial: RouteValue) {
  latest = initial;
  return render(
    <Providers>
      <Controlled initial={initial} />
    </Providers>
  );
}

beforeEach(() => {
  clickMap = null;
  lastMarker = null;
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
});

describe("the route map Landmarks editor", () => {
  it("places a pin by a map click, names it, and writes lat, lng, and name", async () => {
    renderForm({});
    const field = screen.getByTestId("landmarks-field");
    expect(within(field).getByText("Landmarks")).toBeInTheDocument();
    expect(within(field).getByTestId("landmarks-count")).toHaveTextContent("0 of 50");
    fireEvent.click(within(field).getByRole("button", { name: /add landmark/i }));
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await waitFor(() => expect(clickMap).not.toBeNull());
    act(() => clickMap!({ latLng: latLng(46.8721234, -113.9940456) }));
    expect(lastMarker?.onMap).toBe(true);
    expect(lastMarker?.position).toEqual({ lat: 46.87212, lng: -113.99405 });
    expect(within(dialog).getByLabelText("Latitude")).toHaveValue("46.87212");
    expect(within(dialog).getByLabelText("Longitude")).toHaveValue("-113.99405");
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "  Caras Park " },
    });
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(latest.landmarks).toEqual([{ name: "Caras Park", lat: 46.87212, lng: -113.99405 }]);
    expect(screen.getByTestId("landmarks-count")).toHaveTextContent("1 of 50");
    expect(screen.getByTestId("landmark-0")).toHaveTextContent("Caras Park");
    expect(JSON.parse(JSON.stringify(latest))).not.toHaveProperty("pois");
  });

  it("edits, reorders, and deletes entries", async () => {
    renderForm({
      landmarks: [
        { name: "A", lat: 1, lng: 2 },
        { name: "B", lat: 3, lng: 4 },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Move B up" }));
    expect(latest.landmarks?.map((l) => l.name)).toEqual(["B", "A"]);
    fireEvent.click(screen.getByRole("button", { name: "Edit A" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Latitude")).toHaveValue("1");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "A2" } });
    fireEvent.change(within(dialog).getByLabelText("Longitude"), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(latest.landmarks).toEqual([
      { name: "B", lat: 3, lng: 4 },
      { name: "A2", lat: 1, lng: 5 },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Delete B" }));
    expect(latest.landmarks).toEqual([{ name: "A2", lat: 1, lng: 5 }]);
    fireEvent.click(screen.getByRole("button", { name: "Delete A2" }));
    expect(latest.landmarks).toBeUndefined();
  });

  it("disables Add at the cap and shows the count", () => {
    const full = Array.from({ length: MAX_LANDMARKS }, (_, i) => ({
      name: `L${i}`,
      lat: 1,
      lng: 1,
    }));
    renderForm({ landmarks: full });
    expect(screen.getByTestId("landmarks-count")).toHaveTextContent("50 of 50");
    expect(screen.getByRole("button", { name: /add landmark/i })).toBeDisabled();
  });
});

describe("a landmark's icon and description", () => {
  it("picks an icon, counts the description, and writes both", async () => {
    renderForm({ landmarks: [{ name: "A", lat: 1, lng: 2 }] });
    expect(screen.queryByTestId("landmark-0-icon")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit A" }));
    const dialog = await screen.findByRole("dialog");
    const iconControl = within(dialog).getByTestId("landmark-icon");
    expect(within(iconControl).getByText("None")).toBeInTheDocument();
    fireEvent.click(within(iconControl).getByRole("button", { name: "Choose" }));
    const picker = await screen.findByRole("dialog", { name: "Choose icon" });
    fireEvent.click(await within(picker).findByTestId("icon-tile-cookie"));
    fireEvent.click(within(picker).getByRole("button", { name: "Choose" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose icon" })).toBeNull()
    );
    expect(within(iconControl).getByRole("button", { name: "Clear" })).toBeInTheDocument();

    const count = within(dialog).getByTestId("landmark-description-count");
    expect(count).toHaveTextContent(`0 / ${MAX_LANDMARK_DESCRIPTION}`);
    expect(
      within(dialog).getByText("The site shows this when a visitor taps the landmark.")
    ).toBeInTheDocument();
    const description = within(dialog).getByLabelText("Description");
    fireEvent.change(description, { target: { value: "Cocoa by the fountain" } });
    expect(count).toHaveTextContent(`21 / ${MAX_LANDMARK_DESCRIPTION}`);
    fireEvent.change(description, { target: { value: "y".repeat(400) } });
    expect(description).toHaveValue("y".repeat(MAX_LANDMARK_DESCRIPTION));
    expect(count).toHaveTextContent(
      `${MAX_LANDMARK_DESCRIPTION} / ${MAX_LANDMARK_DESCRIPTION}`
    );
    fireEvent.change(description, { target: { value: " Cocoa by the fountain " } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(latest.landmarks).toEqual([
      {
        name: "A",
        lat: 1,
        lng: 2,
        icon: { source: "library", id: "cookie" },
        description: "Cocoa by the fountain",
      },
    ]);
    const preview = screen.getByTestId("landmark-0-icon");
    expect(await within(preview).findByTestId("icon-preview-image")).toBeInTheDocument();
  });

  it("opens a stored icon and description, and clearing both removes the keys", async () => {
    const icon = { source: "media" as const, id: "m1" };
    renderForm({
      landmarks: [
        { name: "A", lat: 1, lng: 2, icon, description: "Cocoa" },
        { name: "B", lat: 3, lng: 4 },
      ],
    });
    expect(screen.getByTestId("landmark-0-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("landmark-1-icon")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Move B up" }));
    expect(latest.landmarks).toEqual([
      { name: "B", lat: 3, lng: 4 },
      { name: "A", lat: 1, lng: 2, icon, description: "Cocoa" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Edit A" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Description")).toHaveValue("Cocoa");
    const iconControl = within(dialog).getByTestId("landmark-icon");
    fireEvent.click(within(iconControl).getByRole("button", { name: "Clear" }));
    expect(within(iconControl).getByText("None")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(JSON.parse(JSON.stringify(latest.landmarks))).toEqual([
      { name: "B", lat: 3, lng: 4 },
      { name: "A", lat: 1, lng: 2 },
    ]);
    expect(screen.queryByTestId("landmark-1-icon")).toBeNull();
  });
});

describe("the route map Points of interest editor", () => {
  it("reads absent as Default and writes absent, empty, and the union", () => {
    renderForm({});
    const field = screen.getByTestId("pois-field");
    expect(within(field).getByText("Points of interest")).toBeInTheDocument();
    expect(within(field).getByRole("radio", { name: "Default" })).toBeChecked();
    expect(within(field).queryByTestId("pois-categories")).toBeNull();

    fireEvent.click(within(field).getByRole("radio", { name: "Custom" }));
    expect(latest.pois).toEqual({ kinds: [] });
    expect(within(field).getByText(/the map shows no places/i)).toBeInTheDocument();

    fireEvent.click(within(field).getByRole("checkbox", { name: "Groceries and stores" }));
    fireEvent.click(within(field).getByRole("checkbox", { name: "Gas and convenience" }));
    expect(latest.pois).toEqual({ kinds: kindsFor(["stores", "gas"]) });
    expect(latest.pois?.kinds.filter((k) => k === "convenience")).toHaveLength(1);

    fireEvent.click(within(field).getByRole("checkbox", { name: "Groceries and stores" }));
    expect(latest.pois).toEqual({ kinds: kindsFor(["gas"]) });

    fireEvent.click(within(field).getByRole("radio", { name: "Default" }));
    expect(latest.pois).toBeUndefined();
    expect(JSON.parse(JSON.stringify(latest))).not.toHaveProperty("pois");
  });

  it("shows a stored list as Custom with its categories checked", () => {
    renderForm({ pois: { kinds: kindsFor(["churches", "health"]) } });
    const field = screen.getByTestId("pois-field");
    expect(within(field).getByRole("radio", { name: "Custom" })).toBeChecked();
    expect(within(field).getByRole("checkbox", { name: "Churches" })).toBeChecked();
    expect(within(field).getByRole("checkbox", { name: "Health" })).toBeChecked();
    expect(within(field).getByRole("checkbox", { name: "Schools" })).not.toBeChecked();
  });
});
