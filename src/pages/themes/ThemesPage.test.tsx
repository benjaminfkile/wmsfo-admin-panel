// admin.md 6.28, 9.2: the Tracker themes page shows the Google Maps and
// MapLibre groups of cards in `sortOrder`, patches `sortOrder` on a drop,
// serves the starter style, and deletes through the `themes` impact
// preview with the optional Replace with select.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ThemesPage from "./ThemesPage";
import { sortOrderPatches } from "./themeOrder";
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
import lightStyle from "../../../contracts/fixtures/themes/light.json";
import type { TrackerTheme } from "../../api/types";

vi.mock("maplibre-gl", () => {
  class Map {
    on() {
      return this;
    }
    remove() {
      return undefined;
    }
    addImage() {
      return undefined;
    }
    hasImage() {
      return false;
    }
  }
  return { Map, addProtocol: () => undefined, setWorkerUrl: () => undefined };
});

vi.mock("pmtiles", () => ({
  Protocol: class {
    tile = () => undefined;
  },
  PMTiles: class {},
}));

vi.mock("../places/googleMaps", () => ({
  loadMaps: () => new Promise(() => undefined),
}));

const downloads = vi.hoisted(() => [] as Array<{ blob: Blob; filename: string }>);
vi.mock("../../lib/download", () => ({
  downloadBlob: (blob: Blob, filename: string) => {
    downloads.push({ blob, filename });
  },
}));

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
          <MemoryRouter initialEntries={["/themes"]}>
            <NotifyProvider>
              <ThemesPage />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

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

beforeEach(() => {
  downloads.length = 0;
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
  vi.restoreAllMocks();
});

const API = testConfig.apiBaseUrl;
const BASE = testConfig.routeBasemapUrl;

function blobText(blob: Blob): Promise<string> {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

async function openMenuItem(theme: TrackerTheme, name: RegExp) {
  const user = userEvent.setup();
  const card = await screen.findByTestId(`theme-card-${String(theme.id)}`);
  await user.click(within(card).getByRole("button", { name: /actions for/i }));
  await user.click(await screen.findByRole("menuitem", { name }));
}
const byKey = (key: string) => f.trackerThemes.find((t) => t.key === key)!;

function cardIds(renderer: "google" | "maplibre"): string[] {
  const group = screen.getByTestId(`themes-group-${renderer}`);
  return within(group)
    .getAllByTestId(/^theme-card-\d+$/)
    .map((el) => el.getAttribute("data-testid")!.replace("theme-card-", ""));
}

async function openDelete(theme: TrackerTheme) {
  const user = userEvent.setup();
  const card = await screen.findByTestId(`theme-card-${String(theme.id)}`);
  await user.click(within(card).getByRole("button", { name: /actions for/i }));
  await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
  return user;
}

describe("ThemesPage", () => {
  it("shows the two groups in sortOrder with a card per theme", async () => {
    // Nebula carries a thumbnail; the rest show the chrome swatch.
    const nebula = byKey("nebula");
    const withThumb = f.trackerThemes.map((t) =>
      t.id === nebula.id ? { ...t, thumbnailMediaId: "thumb-1" } : t
    );
    // Listed out of order so the page has to sort.
    server.use(
      http.get(`${API}/admin/themes`, () =>
        HttpResponse.json({ items: [...withThumb].reverse() })
      ),
      http.get(`${API}/admin/media/:id`, () =>
        HttpResponse.json({
          id: "thumb-1",
          url: "https://cdn.example/media/thumb-1.png",
          variants: { "480": "https://cdn.example/media/thumb-1-480.webp" },
        })
      )
    );
    render(<Harness />);
    expect(
      await screen.findByRole("heading", { name: "Google Maps" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MapLibre" })).toBeInTheDocument();
    await screen.findByTestId(`theme-card-${String(nebula.id)}`);

    const ids = (keys: string[]) => keys.map((k) => String(byKey(k).id));
    expect(cardIds("google")).toEqual(
      ids(["standard", "expedition", "blizzard", "charcoal", "night", "nebula"])
    );
    expect(cardIds("maplibre")).toEqual(ids(["light", "dark"]));

    const light = byKey("light");
    const card = screen.getByTestId(`theme-card-${String(light.id)}`);
    expect(within(card).getByText("Light")).toBeInTheDocument();
    const key = within(card).getByText("light");
    expect(key).toHaveStyle({ fontFamily: "monospace" });
    expect(within(card).getByTestId(`theme-swatch-${String(light.id)}`)).toBeInTheDocument();
    const chrome = within(card).getByTestId(`theme-chrome-${String(light.id)}`);
    expect(chrome.children).toHaveLength(7);
    expect(
      within(chrome).getByTestId(`theme-chrome-${String(light.id)}-accent`)
    ).toHaveAttribute("data-colour", light.chrome!.accent);
    expect(within(card).getByText("Light default")).toBeInTheDocument();
    expect(within(card).queryByText("Dark default")).toBeNull();
    // The fixture event offers themes 1 and 2.
    await waitFor(() =>
      expect(within(card).getByTestId(`theme-events-${String(light.id)}`)).toHaveTextContent(
        "Used by 1 event"
      )
    );
    expect(within(card).getByRole("button", { name: /edit light/i })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /audit light/i })).toBeInTheDocument();

    const night = screen.getByTestId(`theme-card-${String(byKey("night").id)}`);
    expect(within(night).getByText("Dark default")).toBeInTheDocument();
    expect(within(night).getByText("Used by 0 events")).toBeInTheDocument();

    const thumb = await screen.findByTestId(`theme-thumb-${String(nebula.id)}`);
    expect(thumb).toHaveAttribute("src", "https://cdn.example/media/thumb-1-480.webp");
  });

  it("a drop within a group patches sortOrder on the moved cards", async () => {
    const patches: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.patch(`${API}/admin/themes/:id`, async ({ params, request }) => {
        const body = await request.json();
        patches.push({ id: String(params.id), body });
        return HttpResponse.json({ ...f.trackerThemes[0], ...(body as object) });
      })
    );
    // Lay the cards out in a column, 100 px apart, so the keyboard
    // sensor can move between them.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const card = this.closest("[data-testid^='theme-card-']");
        const group = card?.parentElement;
        const i = card && group ? Array.from(group.children).indexOf(card) : 0;
        const top = i * 100;
        return {
          x: 0,
          y: top,
          top,
          left: 0,
          right: 300,
          bottom: top + 90,
          width: 300,
          height: 90,
          toJSON: () => ({}),
        } as DOMRect;
      }
    );
    render(<Harness />);
    const standard = byKey("standard");
    const expedition = byKey("expedition");
    const blizzard = byKey("blizzard");
    const handle = await screen.findByTestId(`theme-drag-${String(standard.id)}`);
    handle.focus();
    await act(async () => {
      fireEvent.keyDown(handle, { key: " ", code: "Space" });
    });
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? handle, {
        key: "ArrowDown",
        code: "ArrowDown",
      });
    });
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? handle, {
        key: "ArrowDown",
        code: "ArrowDown",
      });
    });
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? handle, { key: " ", code: "Space" });
    });

    await waitFor(() => expect(patches).toHaveLength(2));
    // Standard moves below Expedition; the two cards trade positions
    // 10 and 20, and the cards after them are not sent.
    const sent = Object.fromEntries(patches.map((p) => [p.id, p.body]));
    expect(sent).toEqual({
      [String(expedition.id)]: { sortOrder: 10 },
      [String(standard.id)]: { sortOrder: 20 },
    });
    expect(cardIds("google").slice(0, 3)).toEqual(
      [expedition, standard, blizzard].map((t) => String(t.id))
    );
    expect(screen.queryByText(/saved/i)).toBeNull();
  });

  it("sortOrderPatches sends only the cards whose position changed", () => {
    const t = (id: number, sortOrder: number) => ({ id, sortOrder }) as TrackerTheme;
    expect(sortOrderPatches([t(2, 20), t(1, 10), t(3, 30)])).toEqual([
      { id: 2, sortOrder: 10 },
      { id: 1, sortOrder: 20 },
    ]);
    expect(sortOrderPatches([t(2, 10), t(1, 10)])).toEqual([
      { id: 1, sortOrder: 20 },
    ]);
  });

  it("Download starter style serves the seed prepared for Maputnik as starter-style.json", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      await screen.findByRole("button", { name: /download starter style/i })
    );
    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.filename).toBe("starter-style.json");
    const blob = downloads[0]!.blob;
    expect(blob.type).toBe("application/json");
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(JSON.parse(text)).toEqual({
      ...lightStyle,
      glyphs: `${BASE}/glyphs/{fontstack}/{range}.pbf`,
      sources: {
        basemap: { ...lightStyle.sources.basemap, url: `pmtiles://${BASE}/tiles.pmtiles` },
        terrain: { ...lightStyle.sources.terrain, url: `pmtiles://${BASE}/terrain.pmtiles` },
      },
    });
    expect(screen.getByTestId("help-themes.starter-style")).toBeInTheDocument();
    expect(screen.getByTestId("help-themes")).toBeInTheDocument();
  });

  it("Download style on a MapLibre card saves <key>.json with the sources filled", async () => {
    const light = byKey("light");
    render(<Harness />);
    await openMenuItem(light, /^download style$/i);
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]!.filename).toBe("light.json");
    const body = JSON.parse(await blobText(downloads[0]!.blob));
    const seed = f.themeStyles.light as typeof lightStyle;
    expect(body.glyphs).toBe(`${BASE}/glyphs/{fontstack}/{range}.pbf`);
    expect(body.sources.basemap).toEqual({
      ...seed.sources.basemap,
      url: `pmtiles://${BASE}/tiles.pmtiles`,
    });
    expect(body.sources.terrain).toEqual({
      ...seed.sources.terrain,
      url: `pmtiles://${BASE}/terrain.pmtiles`,
    });
    expect(body.layers).toEqual(seed.layers);
  });

  it("Download style on a Google card saves the array as <key>.json", async () => {
    const night = byKey("night");
    render(<Harness />);
    await openMenuItem(night, /^download style$/i);
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]!.filename).toBe("night.json");
    expect(JSON.parse(await blobText(downloads[0]!.blob))).toEqual(f.themeStyles.night);
  });

  it("Download style toasts a failed fetch", async () => {
    server.use(
      http.get("https://cdn.example/themes/:renderer/:file", () =>
        HttpResponse.json({}, { status: 500 })
      )
    );
    render(<Harness />);
    await openMenuItem(byKey("dark"), /^download style$/i);
    expect(
      await screen.findByText("The theme style could not load (500).")
    ).toBeInTheDocument();
    expect(downloads).toHaveLength(0);
  });

  it("New theme and the pencil open the editor dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /new theme/i }));
    expect(
      await screen.findByRole("dialog", { name: "New theme" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: /edit night/i }));
    expect(
      await screen.findByRole("dialog", { name: "Edit Night" })
    ).toBeInTheDocument();
  });

  it("Delete offers Replace with over the same renderer and sends replacementId", async () => {
    let deleted: { url: string; body: string } | null = null;
    server.use(
      http.delete(`${API}/admin/themes/:id`, async ({ request }) => {
        deleted = { url: request.url, body: await request.text() };
        return new HttpResponse(null, { status: 204 });
      })
    );
    const light = byKey("light");
    const dark = byKey("dark");
    render(<Harness />);
    const user = await openDelete(light);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/delete light\?/i);
    expect(within(dialog).getByTestId("help-themes.delete")).toBeInTheDocument();
    await within(dialog).findByText(/loses its light default/i);
    const select = await within(dialog).findByRole("combobox", {
      name: /replace with/i,
    });
    await user.click(select);
    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toContain("Dark");
    expect(options).not.toContain("Light");
    for (const g of ["Standard", "Night", "Nebula"]) {
      expect(options).not.toContain(g);
    }
    await user.click(within(listbox).getByRole("option", { name: "Dark" }));
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(deleted).not.toBeNull());
    expect(new URL(deleted!.url).pathname).toBe(`/admin/themes/${String(light.id)}`);
    expect(JSON.parse(deleted!.body)).toEqual({ replacementId: Number(dark.id) });
    expect(await screen.findByText("Theme deleted")).toBeInTheDocument();
  });

  it("shows the blocked sentence alone with Close", async () => {
    const standard = byKey("standard");
    const sentence =
      "Standard is the only enabled Google theme on Santa Flyover 2026.";
    server.use(
      http.get(`${API}/admin/themes/:id/impact`, () =>
        HttpResponse.json({
          blocked: sentence,
          deletes: [],
          unlinks: [{ entity: "event", count: 1, names: ["Santa Flyover 2026"] }],
          warnings: [],
        })
      )
    );
    render(<Harness />);
    await openDelete(standard);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(sentence)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^close$/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^delete$/i })).toBeNull();
    expect(
      within(dialog).queryByRole("combobox", { name: /replace with/i })
    ).toBeNull();
  });

  it("stacks the groups on compact with 44 px drag handles", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(<Harness />);
      const groups = await screen.findByTestId("themes-groups");
      expect(groups).toHaveAttribute("data-layout", "stacked");
      const handle = await screen.findByTestId(
        `theme-drag-${String(byKey("standard").id)}`
      );
      expect(handle).toHaveStyle({ width: "44px", height: "44px" });
    } finally {
      restore();
    }
  });

  it("puts the groups side by side on desktop", async () => {
    const restore = stubMatchMedia(false);
    try {
      render(<Harness />);
      expect(await screen.findByTestId("themes-groups")).toHaveAttribute(
        "data-layout",
        "side-by-side"
      );
    } finally {
      restore();
    }
  });
});
