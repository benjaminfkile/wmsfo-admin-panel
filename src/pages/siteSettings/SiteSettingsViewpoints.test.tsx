// admin.md 6.16: the Viewpoints field of Site settings, edited through
// ViewpointsEditor and saved under `landmarks`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
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
import {
  MAX_VIEWPOINT_DESCRIPTION,
  MAX_VIEWPOINTS,
  type Viewpoint,
} from "../../components/content/viewpoints";

vi.setConfig({ testTimeout: 20_000 });

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

vi.mock("../places/googleMaps", () => ({
  loadMaps: vi.fn(async () => ({ Map: FakeMap }) as unknown as google.maps.MapsLibrary),
  loadMarkers: vi.fn(
    async () => ({ Marker: FakeMarkerCtor }) as unknown as google.maps.MarkerLibrary
  ),
  loadPlaces: vi.fn(async () => ({})),
}));

import SiteSettings from "./SiteSettings";

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
          <MemoryRouter initialEntries={["/site-settings"]}>
            <NotifyProvider>
              <SiteSettings />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const DRAFT = {
  siteName: "Western Montana Santa Flyover",
  tagline: null,
  homeNavLabel: "Home",
  logo: null,
  favicon: null,
  theme: { snowDefault: false, lightsDefault: true },
  navExtraLinks: [],
  footerLinks: [],
  footerText: null,
  contactEmail: null,
  donateUrl: null,
  analyticsEnabled: false,
};

let saved: Array<Record<string, unknown>> = [];

function serve(landmarks?: Viewpoint[]) {
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
      HttpResponse.json({
        ...f.siteSettingsDraft,
        data: landmarks === undefined ? DRAFT : { ...DRAFT, landmarks },
      })
    ),
    http.put(`${testConfig.apiBaseUrl}/admin/site-settings`, async ({ request }) => {
      const body = (await request.json()) as { data: Record<string, unknown> };
      saved.push(body.data);
      return HttpResponse.json({ ...f.siteSettingsDraft, data: body.data });
    })
  );
}

async function renderPage(landmarks?: Viewpoint[]) {
  serve(landmarks);
  const result = render(<Harness />);
  const field = await screen.findByTestId("viewpoints-field");
  if (landmarks !== undefined && landmarks.length > 0) {
    await within(field).findByTestId("viewpoint-0");
  }
  return { ...result, field };
}

// Saves and returns the document the PUT carried.
async function save(): Promise<Record<string, unknown>> {
  const button = screen.getByTestId("site-settings-save");
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  await waitFor(() => expect(saved.length).toBeGreaterThan(0));
  return JSON.parse(JSON.stringify(saved.at(-1))) as Record<string, unknown>;
}

async function addByFields(name: string, lat: string, lng: string) {
  fireEvent.click(screen.getByRole("button", { name: /add viewpoint/i }));
  const dialog = await screen.findByRole("dialog", { name: "Add viewpoint" });
  fireEvent.change(within(dialog).getByLabelText("Latitude"), { target: { value: lat } });
  fireEvent.change(within(dialog).getByLabelText("Longitude"), { target: { value: lng } });
  fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: name } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Add viewpoint" })).toBeNull()
  );
}

beforeEach(() => {
  clickMap = null;
  lastMarker = null;
  saved = [];
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

describe("Site settings: the Viewpoints field", () => {
  it("renders the Viewpoints editor with its label and help, after the header links", async () => {
    const { container, field } = await renderPage();
    expect(within(field).getByText("Viewpoints")).toBeInTheDocument();
    expect(
      within(field).getByText("Good spots to watch Santa fly over, drawn on the route preview and the live tracker.")
    ).toBeInTheDocument();
    expect(within(field).getByTestId("viewpoints-count")).toHaveTextContent("0 of 50");
    const text = container.textContent ?? "";
    expect(text).not.toContain("landmarks");
    expect(text.indexOf("Good spots to watch")).toBeGreaterThan(text.indexOf("Header links"));
  });

  it("saves a two-viewpoint list under landmarks", async () => {
    await renderPage();
    await addByFields("  Caras Park ", "46.8703", "-113.9958");
    await addByFields("Fort Missoula", "46.8455", "-114.0569");
    expect(screen.getByTestId("viewpoints-count")).toHaveTextContent("2 of 50");
    const data = await save();
    expect(data.landmarks).toEqual([
      { name: "Caras Park", lat: 46.8703, lng: -113.9958 },
      { name: "Fort Missoula", lat: 46.8455, lng: -114.0569 },
    ]);
    expect(data.siteName).toBe(DRAFT.siteName);
  });

  it("places a pin by a map click, names it, and writes lat, lng, and name", async () => {
    const { field } = await renderPage();
    fireEvent.click(within(field).getByRole("button", { name: /add viewpoint/i }));
    const dialog = await screen.findByRole("dialog", { name: "Add viewpoint" });
    const ok = within(dialog).getByRole("button", { name: "Save" });
    expect(ok).toBeDisabled();
    await waitFor(() => expect(clickMap).not.toBeNull());
    act(() => clickMap!({ latLng: latLng(46.8721234, -113.9940456) }));
    expect(lastMarker?.onMap).toBe(true);
    expect(lastMarker?.position).toEqual({ lat: 46.87212, lng: -113.99405 });
    expect(within(dialog).getByLabelText("Latitude")).toHaveValue("46.87212");
    expect(within(dialog).getByLabelText("Longitude")).toHaveValue("-113.99405");
    expect(ok).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "  Caras Park " },
    });
    fireEvent.click(ok);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add viewpoint" })).toBeNull());
    expect(screen.getByTestId("viewpoints-count")).toHaveTextContent("1 of 50");
    expect(screen.getByTestId("viewpoint-0")).toHaveTextContent("Caras Park");
    const data = await save();
    expect(data.landmarks).toEqual([{ name: "Caras Park", lat: 46.87212, lng: -113.99405 }]);
  });

  it("edits, reorders, and deletes entries, and an emptied list saves as absent", async () => {
    await renderPage([
      { name: "A", lat: 1, lng: 2 },
      { name: "B", lat: 3, lng: 4 },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Move B up" }));
    expect(screen.getByTestId("viewpoint-0")).toHaveTextContent("B");
    fireEvent.click(screen.getByRole("button", { name: "Edit A" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Latitude")).toHaveValue("1");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "A2" } });
    fireEvent.change(within(dialog).getByLabelText("Longitude"), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await save()).landmarks).toEqual([
      { name: "B", lat: 3, lng: 4 },
      { name: "A2", lat: 1, lng: 5 },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Delete B" }));
    expect(screen.getByTestId("viewpoints-count")).toHaveTextContent("1 of 50");
    fireEvent.click(screen.getByRole("button", { name: "Delete A2" }));
    expect(screen.getByTestId("viewpoints-count")).toHaveTextContent("0 of 50");
    saved = [];
    const data = await save();
    expect(data).not.toHaveProperty("landmarks");
  });

  it("disables Add at the cap and shows the count", async () => {
    const full = Array.from({ length: MAX_VIEWPOINTS }, (_, i) => ({
      name: `L${i}`,
      lat: 1,
      lng: 1,
    }));
    await renderPage(full);
    expect(screen.getByTestId("viewpoints-count")).toHaveTextContent("50 of 50");
    expect(screen.getByRole("button", { name: /add viewpoint/i })).toBeDisabled();
  });
});

describe("Site settings: a viewpoint's icon and description", () => {
  it("picks an icon, counts the description, and writes both", async () => {
    await renderPage([{ name: "A", lat: 1, lng: 2 }]);
    expect(screen.queryByTestId("viewpoint-0-icon")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit A" }));
    const dialog = await screen.findByRole("dialog");
    const iconControl = within(dialog).getByTestId("viewpoint-icon");
    expect(within(iconControl).getByText("None")).toBeInTheDocument();
    fireEvent.click(within(iconControl).getByRole("button", { name: "Choose" }));
    const picker = await screen.findByRole("dialog", { name: "Choose icon" });
    fireEvent.click(await within(picker).findByTestId("icon-tile-cookie"));
    fireEvent.click(within(picker).getByRole("button", { name: "Choose" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose icon" })).toBeNull()
    );
    expect(within(iconControl).getByRole("button", { name: "Clear" })).toBeInTheDocument();

    const count = within(dialog).getByTestId("viewpoint-description-count");
    expect(count).toHaveTextContent(`0 / ${MAX_VIEWPOINT_DESCRIPTION}`);
    expect(
      within(dialog).getByText("The site shows this when a visitor taps the viewpoint.")
    ).toBeInTheDocument();
    const description = within(dialog).getByLabelText("Description");
    fireEvent.change(description, { target: { value: "Cocoa by the fountain" } });
    expect(count).toHaveTextContent(`21 / ${MAX_VIEWPOINT_DESCRIPTION}`);
    fireEvent.change(description, { target: { value: "y".repeat(400) } });
    expect(description).toHaveValue("y".repeat(MAX_VIEWPOINT_DESCRIPTION));
    expect(count).toHaveTextContent(
      `${MAX_VIEWPOINT_DESCRIPTION} / ${MAX_VIEWPOINT_DESCRIPTION}`
    );
    fireEvent.change(description, { target: { value: " Cocoa by the fountain " } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const preview = screen.getByTestId("viewpoint-0-icon");
    expect(await within(preview).findByTestId("icon-preview-image")).toBeInTheDocument();
    expect((await save()).landmarks).toEqual([
      {
        name: "A",
        lat: 1,
        lng: 2,
        icon: { source: "library", id: "cookie" },
        description: "Cocoa by the fountain",
      },
    ]);
  });

  it("opens a stored icon and description, and clearing both removes the keys", async () => {
    const icon = { source: "media" as const, id: "m1" };
    await renderPage([
      { name: "A", lat: 1, lng: 2, icon, description: "Cocoa" },
      { name: "B", lat: 3, lng: 4 },
    ]);
    expect(screen.getByTestId("viewpoint-0-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("viewpoint-1-icon")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Move B up" }));
    expect(screen.queryByTestId("viewpoint-0-icon")).toBeNull();
    expect(screen.getByTestId("viewpoint-1-icon")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit A" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Description")).toHaveValue("Cocoa");
    const iconControl = within(dialog).getByTestId("viewpoint-icon");
    fireEvent.click(within(iconControl).getByRole("button", { name: "Clear" }));
    expect(within(iconControl).getByText("None")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByTestId("viewpoint-1-icon")).toBeNull();
    expect((await save()).landmarks).toEqual([
      { name: "B", lat: 3, lng: 4 },
      { name: "A", lat: 1, lng: 2 },
    ]);
  });
});
