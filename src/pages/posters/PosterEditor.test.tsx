import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PosterEditor, { NAME_REQUIRED, NO_BASEMAP_HINT, NO_RECORDING_HINT } from "./PosterEditor";
import { NO_START_HINT, SIZE_LIMIT_MESSAGE } from "./PosterStudioWorkspace";
import { ConfigProvider } from "../../ConfigContext";
import type { Config } from "../../config";
import { NotifyProvider } from "../../hooks/useNotify";
import AuthProvider from "../../auth/AuthProvider";
import AppRoutes from "../../AppRoutes";
import { installClient } from "../../api/client";
import type { Poster } from "../../api/types";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import { ATTRIBUTION_TEXT, resetTerrainProbes } from "../../routeMap/poster";
import {
  ARROWS_LAYER,
  DETAIL_LAYERS,
  HILLSHADE_LAYER,
  ROUTE_ARROW_ICON,
  ROUTE_PALETTES,
  TERRAIN_SOURCE,
  TIME_LABELS_SOURCE,
} from "../../routeMap";
import { buildPosterStyle } from "../../routeMap/posterStyle";
import { loadOverlayImage } from "../../routeMap/overlayImage";
import { OVERLAY_STAGE_WIDTH } from "../../routeMap/posterOverlay";
import {
  DEFAULT_DESIGN,
  DEFAULT_DETAILS,
  DEFAULT_ROUTE_STYLE,
  toLayoutDocument,
  type PosterLayout,
} from "../../routeMap/posterLayout";
import { konvaLog } from "../../test/konva/konvaMock";
import QRCode from "qrcode";

vi.setConfig({ testTimeout: 15_000 });

// Every step of the flow appends here so the tests can check the order.
const calls: string[] = [];
// The recordings whose route map was read.
const routeMapIds: number[] = [];
// The offscreen export maps.
const mapOptions: Array<{ pixelRatio: number; style: unknown }> = [];
// The preview maps: the style they were created with, every style set
// on them since, and the images added to them.
type PreviewMap = { styles: unknown[]; images: string[] };
const previews: PreviewMap[] = [];
const exportImages: string[][] = [];

vi.mock("maplibre-gl", () => {
  class Map {
    private canvas = document.createElement("canvas");
    private images: string[] = [];
    private preview: PreviewMap | null = null;
    constructor(opts: { container: HTMLElement; pixelRatio: number; style: unknown }) {
      if (opts.container.style.left === "-100000px") {
        calls.push("render");
        mapOptions.push(opts);
        exportImages.push(this.images);
      } else {
        this.preview = { styles: [opts.style], images: this.images };
        previews.push(this.preview);
      }
      this.canvas.width = Math.floor(parseFloat(opts.container.style.width) * opts.pixelRatio);
      this.canvas.height = Math.floor(parseFloat(opts.container.style.height) * opts.pixelRatio);
    }
    once(type: string, cb: () => void) {
      if (type === "idle") setTimeout(cb, 0);
      return this;
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
      this.preview?.styles.push(style);
    }
    setPixelRatio() {
      return undefined;
    }
    resize() {
      return this;
    }
    fitBounds() {
      return this;
    }
    getCanvas() {
      return this.canvas;
    }
    remove() {
      return undefined;
    }
  }
  return { Map, addProtocol: () => undefined, setWorkerUrl: () => undefined };
});

// jsdom has no canvas for Konva to draw on; the stand-ins record what the
// composer and the export draw.
vi.mock("konva", () => import("../../test/konva/konvaMock"));
vi.mock("react-konva", () => import("../../test/konva/reactKonvaMock"));

vi.mock("qrcode", () => ({
  default: {
    toString: vi.fn(async () => "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
    toDataURL: vi.fn(async () => "data:image/png;base64,"),
  },
}));

// Overlay images never load in jsdom; each test decides how they settle.
vi.mock("../../routeMap/overlayImage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../routeMap/overlayImage")>();
  return { ...actual, loadOverlayImage: vi.fn() };
});

// The shared style call, wrapped so the tests can compare what the preview
// and the export pass it.
vi.mock("../../routeMap/posterStyle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../routeMap/posterStyle")>();
  return { ...actual, buildPosterStyle: vi.fn(actual.buildPosterStyle) };
});

// The terrain probe reads the archive header; each test sets whether it
// resolves or rejects.
const terrainProbe = { exists: false, urls: [] as string[] };

vi.mock("pmtiles", () => ({
  Protocol: class {
    tile = () => undefined;
  },
  PMTiles: class {
    constructor(private url: string) {
      terrainProbe.urls.push(url);
    }
    getHeader() {
      return terrainProbe.exists
        ? Promise.resolve({ minZoom: 0, maxZoom: 12 })
        : Promise.reject(new Error("404"));
    }
  },
}));

const ctx = {
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  roundRect: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  drawImage: vi.fn(() => {
    calls.push("compose");
  }),
  measureText: vi.fn((t: string) => ({ width: t.length * 10 })),
  font: "",
  fillStyle: "",
  textBaseline: "",
  textAlign: "",
};

const API = testConfig.apiBaseUrl;
const POSTER: Poster = { ...f.posters[0]!, layout: null };
const DEFAULT_LAYOUT = toLayoutDocument(DEFAULT_DESIGN, []);
const READY_ASSET = {
  ...f.mediaAssets[0]!,
  id: "poster-asset-1",
  filename: "poster-main-street-light-2048x1536.jpg",
  width: 2048,
  height: 1536,
  state: "ready" as const,
};

const ROUTE_MAP = {
  routeMap: {
    path: [
      { lat: 46.8721, lng: -114.0012 },
      { lat: 46.874032, lng: -114.008311 },
      { lat: 46.886203, lng: -114.017446 },
    ],
    timeline: [
      { minutes: 0, lat: 46.8721, lng: -114.0012 },
      { minutes: 5, lat: 46.874818, lng: -114.009274 },
      { minutes: 10, lat: 46.881297, lng: -114.015672 },
      { minutes: 12, lat: 46.886203, lng: -114.017446 },
    ],
    durationMinutes: 12,
    timed: true,
  },
};

// The editor at /posters/:id, with the poster list standing in as a marker
// so leaving the editor shows.
function Harness({ poster, config = testConfig }: { poster: Poster; config?: Config }) {
  server.use(http.get(`${API}/admin/posters/:id`, () => HttpResponse.json(poster)));
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ConfigProvider config={config}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/posters/${poster.id}`]}>
            <NotifyProvider>
              <Routes>
                <Route path="/posters/:id" element={<PosterEditor />} />
                <Route path="/posters" element={<div data-testid="posters-page" />} />
              </Routes>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

function installFlowHandlers(opts: { uploadUrlStatus?: number } = {}) {
  const uploadBodies: Array<Record<string, unknown>> = [];
  const patches: unknown[] = [];
  server.use(
    http.get(`${API}/admin/routes/:id/route-map`, ({ params }) => {
      calls.push("route-map");
      routeMapIds.push(Number(params.id));
      return HttpResponse.json(ROUTE_MAP);
    }),
    http.post(`${API}/admin/media/upload-url`, async ({ request }) => {
      calls.push("upload-url");
      uploadBodies.push((await request.json()) as Record<string, unknown>);
      if (opts.uploadUrlStatus) {
        return HttpResponse.json(
          {
            code: "payload_too_large",
            message: "Too large",
            details: null,
            requestId: "r1",
          },
          { status: opts.uploadUrlStatus },
        );
      }
      return HttpResponse.json(
        { ...f.uploadTicket, media: { ...READY_ASSET, state: "pending" } },
        { status: 201 },
      );
    }),
    http.put(f.uploadTicket.uploadUrl!, () => {
      calls.push("put");
      return new HttpResponse(null, { status: 200 });
    }),
    http.post(`${API}/admin/media/:id/confirm`, () => {
      calls.push("confirm");
      return HttpResponse.json(READY_ASSET);
    }),
    http.patch(`${API}/admin/posters/:id`, async ({ request }) => {
      calls.push("patch");
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      return HttpResponse.json({ ...POSTER, ...body });
    }),
  );
  return { uploadBodies, patches };
}

beforeEach(() => {
  resetTerrainProbes();
  terrainProbe.exists = false;
  terrainProbe.urls.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  calls.length = 0;
  routeMapIds.length = 0;
  mapOptions.length = 0;
  previews.length = 0;
  exportImages.length = 0;
  vi.mocked(buildPosterStyle).mockClear();
  konvaLog.stages.length = 0;
  vi.mocked(QRCode.toString).mockClear();
  vi.mocked(loadOverlayImage).mockReset();
  vi.mocked(loadOverlayImage).mockImplementation(async (url: string) => {
    const image = document.createElement("img");
    image.src = url;
    return { image, aspect: 0.5 };
  });
  ctx.fillText.mockClear();
  ctx.drawImage.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
  ) {
    calls.push("encode");
    cb(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }));
  });
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] }),
  );
  installClient({ config: testConfig, userManager: um, onMfaRequired: () => undefined });
  server.use(http.get(`${API}/admin/routes/:id/route-map`, () => HttpResponse.json(ROUTE_MAP)));
});

afterEach(() => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

async function openStudio() {
  return screen.findByTestId("poster-studio-workspace");
}

describe("PosterEditor: the page and its guards", () => {
  it("is the page the app routes /posters/:id to", async () => {
    server.use(http.get(`${API}/admin/posters/:id`, () => HttpResponse.json(POSTER)));
    const um = makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] }),
    );
    render(
      <ThemeProvider theme={buildTheme("light")}>
        <ConfigProvider config={testConfig}>
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={[`/posters/${POSTER.id}`]}>
              <AuthProvider userManager={um}>
                <AppRoutes themeMode="light" onToggleTheme={() => undefined} />
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </ConfigProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByTestId("poster-studio-workspace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Poster studio" })).toBeInTheDocument();
    expect(screen.getByTestId("poster-name")).toHaveValue(POSTER.name);
  });

  it("holds the name and the recording in the header and links back to the list", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    render(<Harness poster={POSTER} />);
    const workspace = await openStudio();
    expect(screen.getByRole("heading", { name: "Poster studio" })).toBeInTheDocument();
    expect(screen.getByTestId("poster-name")).toHaveValue("Main street");
    expect(await screen.findByRole("combobox", { name: "Flight recording" })).toHaveTextContent(
      f.routes[0]!.name!,
    );
    expect(screen.getByTestId("poster-back")).toHaveAttribute("href", "/posters");
    // The preview column comes first, the rail with the controls after it.
    const column = within(workspace).getByTestId("poster-studio-preview-column");
    const rail = within(workspace).getByTestId("poster-studio-rail");
    expect(column.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await within(column).findByTestId("route-poster-preview")).toBeInTheDocument();
    expect(within(rail).getByTestId("route-poster-generate-run")).toBeInTheDocument();
    expect(within(rail).getByLabelText("Dark")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    // The map is the chosen recording's.
    await waitFor(() => expect(routeMapIds).toContain(4));
    await user.click(screen.getByTestId("poster-back"));
    expect(await screen.findByTestId("posters-page")).toBeInTheDocument();
  });

  it("shows the hint in place of the workspace without a recording, and a picked one opens it", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    render(<Harness poster={{ ...POSTER, routeId: null }} />);
    expect(await screen.findByTestId("poster-studio-hint")).toHaveTextContent(NO_RECORDING_HINT);
    expect(screen.queryByTestId("poster-studio-workspace")).toBeNull();
    expect(screen.getByTestId("poster-save")).toBeEnabled();
    const picker = screen.getByRole("combobox", { name: "Flight recording" });
    expect(picker).toHaveTextContent("No recording");
    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: f.routes[0]!.name! }));
    expect(await openStudio()).toBeInTheDocument();
    expect(screen.queryByTestId("poster-studio-hint")).toBeNull();
    await waitFor(() => expect(routeMapIds).toEqual([4]));
  });

  it("keeps the design across a switch to no recording and back", async () => {
    const user = userEvent.setup();
    render(<Harness poster={POSTER} />);
    let studio = await openStudio();
    await user.click(within(studio).getByLabelText("Dark"));
    await user.click(within(studio).getByLabelText("Portrait"));
    await user.click(screen.getByRole("combobox", { name: "Flight recording" }));
    await user.click(await screen.findByRole("option", { name: "No recording" }));
    expect(await screen.findByTestId("poster-studio-hint")).toHaveTextContent(NO_RECORDING_HINT);
    await user.click(screen.getByRole("combobox", { name: "Flight recording" }));
    await user.click(await screen.findByRole("option", { name: f.routes[0]!.name! }));
    studio = await openStudio();
    expect(within(studio).getByLabelText("Dark")).toBeChecked();
    expect(within(studio).getByLabelText("Portrait")).toBeChecked();
  });

  it("shows the hint in place of the workspace when VITE_ROUTE_BASEMAP_URL is unset", async () => {
    render(<Harness poster={POSTER} config={{ ...testConfig, routeBasemapUrl: "" }} />);
    expect(await screen.findByTestId("poster-studio-hint")).toHaveTextContent(NO_BASEMAP_HINT);
    expect(screen.getByTestId("poster-studio-hint")).toHaveTextContent(/VITE_ROUTE_BASEMAP_URL/);
    expect(screen.queryByTestId("poster-studio-workspace")).toBeNull();
  });
});

describe("PosterEditor: Save", () => {
  it("saves the name, the recording, and the whole design", async () => {
    const user = userEvent.setup();
    const { patches } = installFlowHandlers();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    const name = screen.getByTestId("poster-name");
    await user.clear(name);
    await user.type(name, "  Downtown  ");
    await user.click(within(studio).getByLabelText("Dark"));
    await user.click(within(studio).getByLabelText(/flyer/i));
    await user.click(screen.getByTestId("poster-save"));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      name: "Downtown",
      routeId: 4,
      layout: { ...DEFAULT_LAYOUT, theme: "dark", size: "flyer" },
    });
    expect(await screen.findByText("Poster saved")).toBeInTheDocument();
    expect(calls).not.toContain("upload-url");
  });

  it("saves a poster without a recording as null and refuses an empty name", async () => {
    const user = userEvent.setup();
    const { patches } = installFlowHandlers();
    render(<Harness poster={{ ...POSTER, routeId: null }} />);
    await screen.findByTestId("poster-studio-hint");
    await user.clear(screen.getByTestId("poster-name"));
    expect(screen.getByTestId("poster-save")).toBeDisabled();
    expect(screen.getByText(NAME_REQUIRED)).toBeInTheDocument();
    await user.type(screen.getByTestId("poster-name"), "Flyer");
    await user.click(screen.getByTestId("poster-save"));
    await waitFor(() =>
      expect(patches).toEqual([{ name: "Flyer", routeId: null, layout: DEFAULT_LAYOUT }]),
    );
  });

  it("shows a failed save and keeps the design", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    server.use(
      http.patch(`${API}/admin/posters/:id`, () =>
        HttpResponse.json(
          { code: "validation_failed", message: "Layout too large", details: null, requestId: "r1" },
          { status: 400 },
        ),
      ),
    );
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    await user.click(within(studio).getByLabelText("Dark"));
    await user.click(screen.getByTestId("poster-save"));
    expect(await screen.findByTestId("poster-save-error")).toHaveTextContent(
      /The poster could not be saved\./,
    );
    expect(within(studio).getByLabelText("Dark")).toBeChecked();
  });
});

describe("PosterEditor: generate from the flight recording", () => {
  it("lists the presets and swaps the pair with the orientation", async () => {
    const user = userEvent.setup();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    expect(screen.queryByTestId("poster-studio-hint")).toBeNull();
    expect(within(studio).getByLabelText(/facebook post, 2048 x 1536/i)).toBeChecked();
    expect(within(studio).getByLabelText(/flyer, letter at 300 dpi, 3300 x 2550/i)).toBeInTheDocument();
    expect(within(studio).getByLabelText(/poster, 11 x 17 at 300 dpi, 5100 x 3300/i)).toBeInTheDocument();
    await user.click(within(studio).getByLabelText("Portrait"));
    expect(within(studio).getByLabelText(/facebook post, 1536 x 2048/i)).toBeChecked();
    expect(within(studio).getByLabelText(/flyer, letter at 300 dpi, 2550 x 3300/i)).toBeInTheDocument();
    expect(within(studio).getByLabelText(/poster, 11 x 17 at 300 dpi, 3300 x 5100/i)).toBeInTheDocument();
    await user.click(within(studio).getByLabelText("Dark"));
    await user.click(within(studio).getByLabelText(/flyer/i));
    expect(within(studio).getByTestId("route-poster-output")).toHaveTextContent(
      "poster-main-street-dark-2550x3300.jpg",
    );
  });

  it("drives render, compose, upload, confirm, save, and ready in order", async () => {
    const user = userEvent.setup();
    const { uploadBodies, patches } = installFlowHandlers();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    await user.click(within(studio).getByTestId("route-poster-generate-run"));

    await within(studio).findByTestId("route-poster-ready");
    expect(calls).toEqual([
      "route-map",
      "render",
      "compose",
      "encode",
      "upload-url",
      "put",
      "confirm",
      "patch",
    ]);
    expect(mapOptions[0]!.pixelRatio).toBe(2);
    expect(ctx.fillText).toHaveBeenCalledWith(
      ATTRIBUTION_TEXT,
      expect.any(Number),
      expect.any(Number),
    );
    expect(uploadBodies[0]).toMatchObject({
      filename: "poster-main-street-light-2048x1536.jpg",
      contentType: "image/jpeg",
      sizeBytes: 4,
      title: "Main street",
    });
    expect(within(studio).getByTestId("route-poster-media-link")).toHaveAttribute(
      "href",
      "/media?id=poster-asset-1",
    );
    // A successful Generate saves the poster; nothing is set on an event.
    expect(patches).toEqual([{ name: "Main street", routeId: 4, layout: DEFAULT_LAYOUT }]);
    expect(screen.queryByRole("button", { name: /set as route poster/i })).toBeNull();
  });

  it("a 413 from the upload surfaces a readable message and the studio stays usable", async () => {
    const user = userEvent.setup();
    installFlowHandlers({ uploadUrlStatus: 413 });
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    expect(await within(studio).findByTestId("route-poster-error")).toHaveTextContent(
      SIZE_LIMIT_MESSAGE,
    );
    expect(within(studio).getByTestId("route-poster-generate-run")).toBeEnabled();
    expect(within(studio).getByTestId("route-poster-generate-run")).toHaveTextContent(/try again/i);
    expect(within(studio).getByLabelText("Dark")).toBeEnabled();
    expect(calls).not.toContain("put");
  });

  it("a render failure surfaces a readable message", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/admin/routes/:id/route-map`, () =>
        HttpResponse.json({ routeMap: null }),
      ),
    );
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    expect(await within(studio).findByTestId("route-poster-error")).toHaveTextContent(
      /could not be drawn.*no path/i,
    );
    expect(within(studio).getByTestId("route-poster-generate-run")).toBeEnabled();
  });

  it("hides the Terrain checkbox when the terrain archive is missing", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    await waitFor(() =>
      expect(terrainProbe.urls).toEqual([`${testConfig.routeBasemapUrl}/terrain.pmtiles`]),
    );
    expect(within(studio).queryByLabelText("Terrain")).toBeNull();
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await within(studio).findByTestId("route-poster-ready");
    const style = mapOptions[0]!.style as { sources: Record<string, unknown> };
    expect(style.sources[TERRAIN_SOURCE]).toBeUndefined();
  });

  it("offers Terrain unchecked when the archive exists and draws the hillshade when checked", async () => {
    const user = userEvent.setup();
    terrainProbe.exists = true;
    installFlowHandlers();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    const box = await within(studio).findByLabelText("Terrain");
    expect(box).not.toBeChecked();

    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await within(studio).findByTestId("route-poster-ready");
    const plain = mapOptions[0]!.style as {
      sources: Record<string, unknown>;
      layers: Array<{ id: string }>;
    };
    expect(plain.sources[TERRAIN_SOURCE]).toBeUndefined();
    expect(plain.layers.map((l) => l.id)).not.toContain(HILLSHADE_LAYER);

    await user.click(within(studio).getByLabelText("Terrain"));
    expect(within(studio).getByLabelText("Terrain")).toBeChecked();
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await waitFor(() => expect(mapOptions).toHaveLength(2));
    const shaded = mapOptions[1]!.style as {
      sources: Record<string, { type: string; url: string }>;
      layers: Array<{ id: string }>;
    };
    expect(shaded.sources[TERRAIN_SOURCE]).toMatchObject({
      type: "raster-dem",
      url: `pmtiles://${testConfig.routeBasemapUrl}/terrain.pmtiles`,
    });
    expect(shaded.layers.map((l) => l.id)).toContain(HILLSHADE_LAYER);
  });

  it("offers the route styling with its defaults and resets the colour to the theme's", async () => {
    const user = userEvent.setup();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    const hex = within(studio).getByTestId("route-poster-color-hex");
    expect(hex).toHaveValue(ROUTE_PALETTES.light.routeColor);
    expect(within(studio).getByTestId("route-poster-color")).toHaveValue(
      ROUTE_PALETTES.light.routeColor,
    );
    expect(within(studio).getByTestId("route-poster-color-reset")).toBeDisabled();
    expect(within(studio).getByLabelText("Arrows")).toBeChecked();
    expect(within(studio).getByRole("combobox", { name: "Arrow size" })).toHaveTextContent("Large");
    expect(within(studio).getByRole("combobox", { name: "Time labels" })).toHaveTextContent(
      "Every 15 minutes",
    );
    // Without a start time the format reads Elapsed, locked, with the hint.
    expect(within(studio).getByRole("combobox", { name: "Label format" })).toHaveTextContent(
      "Elapsed",
    );
    expect(within(studio).getByTestId("route-poster-format-hint")).toHaveTextContent(NO_START_HINT);
    fireEvent.change(within(studio).getByTestId("route-poster-start"), {
      target: { value: "2026-12-21T18:00" },
    });
    expect(within(studio).getByRole("combobox", { name: "Label format" })).toHaveTextContent(
      "Wall clock",
    );
    expect(within(studio).queryByTestId("route-poster-format-hint")).toBeNull();

    await user.click(within(studio).getByLabelText("Dark"));
    expect(hex).toHaveValue(ROUTE_PALETTES.dark.routeColor);

    await user.clear(hex);
    await user.type(hex, "#FF8800");
    await user.tab();
    expect(hex).toHaveValue("#ff8800");
    await user.click(within(studio).getByTestId("route-poster-color-reset"));
    expect(hex).toHaveValue(ROUTE_PALETTES.dark.routeColor);
  });

  it("disables the arrow size while the arrows are off", async () => {
    const user = userEvent.setup();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    const size = within(studio).getByRole("combobox", { name: "Arrow size" });
    expect(size).not.toHaveAttribute("aria-disabled");
    await user.click(within(studio).getByLabelText("Arrows"));
    expect(size).toHaveAttribute("aria-disabled", "true");
    await user.click(within(studio).getByLabelText("Arrows"));
    expect(size).not.toHaveAttribute("aria-disabled");
  });

  it.each([
    ["Small", 0.75],
    ["Medium", 1],
    ["Large", 1.5],
    ["Extra large", 2],
  ])("draws the %s arrows in the preview and the export through the shared style call", async (name, scale) => {
    const user = userEvent.setup();
    installFlowHandlers();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    await within(studio).findByTestId("route-poster-preview");
    await waitFor(() => expect(previews).toHaveLength(1));

    await user.click(within(studio).getByRole("combobox", { name: "Arrow size" }));
    await user.click(await screen.findByRole("option", { name }));
    expect(within(studio).getByRole("combobox", { name: "Arrow size" })).toHaveTextContent(name);
    await waitFor(() =>
      expect(vi.mocked(buildPosterStyle).mock.calls.at(-1)![1].options.arrowScale).toBe(scale),
    );
    const preview = previews[0]!;
    await waitFor(() => {
      const last = preview.styles.at(-1) as {
        layers: Array<{ id: string; layout?: Record<string, unknown> }>;
      };
      expect(last.layers.find((l) => l.id === ARROWS_LAYER)!.layout!["icon-size"]).toBe(scale);
    });

    const previewCalls = vi.mocked(buildPosterStyle).mock.calls.length;
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await within(studio).findByTestId("route-poster-ready");
    const exportCalls = vi.mocked(buildPosterStyle).mock.calls.slice(previewCalls);
    expect(exportCalls).toHaveLength(1);
    expect(exportCalls[0]![1].options.arrowScale).toBe(scale);
  });

  it("offers the three map detail switches on by default", async () => {
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    const group = within(studio).getByTestId("poster-map-details");
    expect(within(group).getByText("Map details")).toBeInTheDocument();
    for (const label of ["Landmarks", "Town names", "Road labels"]) {
      expect(within(group).getByLabelText(label)).toBeChecked();
    }
    await waitFor(() =>
      expect(vi.mocked(buildPosterStyle).mock.calls.at(-1)![1].options.details).toEqual(DEFAULT_DETAILS),
    );
  });

  it("feeds the detail switches to the preview and the export through the shared style call and saves them", async () => {
    const user = userEvent.setup();
    const { patches } = installFlowHandlers();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    await within(studio).findByTestId("route-poster-preview");
    await waitFor(() => expect(previews).toHaveLength(1));
    const preview = previews[0]!;
    const ids = () => (preview.styles.at(-1) as { layers: Array<{ id: string }> }).layers.map((l) => l.id);
    for (const id of [...DETAIL_LAYERS.placeNames, ...DETAIL_LAYERS.roadLabels]) {
      expect(ids()).toContain(id);
    }

    await user.click(within(studio).getByLabelText("Town names"));
    await user.click(within(studio).getByLabelText("Road labels"));
    await user.click(within(studio).getByLabelText("Landmarks"));
    const details = { landmarks: false, placeNames: false, roadLabels: false };
    await waitFor(() =>
      expect(vi.mocked(buildPosterStyle).mock.calls.at(-1)![1].options.details).toEqual(details),
    );
    await waitFor(() => {
      for (const id of [...DETAIL_LAYERS.placeNames, ...DETAIL_LAYERS.roadLabels]) {
        expect(ids()).not.toContain(id);
      }
    });
    await user.click(within(studio).getByLabelText("Landmarks"));
    const kept = { ...details, landmarks: true };
    await waitFor(() =>
      expect(vi.mocked(buildPosterStyle).mock.calls.at(-1)![1].options.details).toEqual(kept),
    );

    const previewCalls = vi.mocked(buildPosterStyle).mock.calls.length;
    const previewInput = vi.mocked(buildPosterStyle).mock.calls.at(-1)!;
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await within(studio).findByTestId("route-poster-ready");
    const exportCalls = vi.mocked(buildPosterStyle).mock.calls.slice(previewCalls);
    expect(exportCalls).toHaveLength(1);
    expect(exportCalls[0]).toEqual(previewInput);
    expect(exportCalls[0]![1].options.details).toEqual(kept);
    expect(mapOptions[0]!.style).toEqual(preview.styles.at(-1));
    expect(patches).toEqual([
      { name: "Main street", routeId: 4, layout: { ...DEFAULT_LAYOUT, details: kept } },
    ]);
  });

  it("opens a layout saved without details with every detail on", async () => {
    const { details: _omitted, ...withoutDetails } = DEFAULT_LAYOUT;
    void _omitted;
    render(<Harness poster={{ ...POSTER, layout: withoutDetails }} />);
    const studio = await openStudio();
    for (const label of ["Landmarks", "Town names", "Road labels"]) {
      expect(within(studio).getByLabelText(label)).toBeChecked();
    }
  });

  it("locks the label format to Elapsed with a hint while no start time is set", async () => {
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    const format = within(studio).getByRole("combobox", { name: "Label format" });
    expect(format).toHaveTextContent("Elapsed");
    expect(format).toHaveAttribute("aria-disabled", "true");
    expect(within(studio).getByTestId("route-poster-format-hint")).toHaveTextContent(
      NO_START_HINT,
    );
    await waitFor(() => expect(previews).toHaveLength(1));
    const labels = vi.mocked(buildPosterStyle).mock.calls.at(-1)![1].options.timeLabels;
    expect(labels?.map((l) => l.label)).toEqual(["0m", "12m"]);
  });

  it("previews the styling live and exports it through the same style call", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    const layout: PosterLayout = {
      ...DEFAULT_LAYOUT,
      routeStyle: {
        ...DEFAULT_ROUTE_STYLE,
        labels: { ...DEFAULT_ROUTE_STYLE.labels, start: "2026-12-21T19:00", zone: "America/Chicago" },
      },
    };
    render(<Harness poster={{ ...POSTER, layout }} />);
    const studio = await openStudio();
    await within(studio).findByTestId("route-poster-preview");
    await waitFor(() => expect(previews).toHaveLength(1));
    const preview = previews[0]!;
    expect(preview.images).toEqual([ROUTE_ARROW_ICON]);

    // The defaults: arrows on, a label every 15 minutes plus the final
    // entry, on the wall clock from the start time in its zone.
    const first = vi.mocked(buildPosterStyle).mock.calls.at(-1)![1];
    expect(first.options).toEqual({
      details: { landmarks: true, placeNames: true, roadLabels: true },
      routeColor: ROUTE_PALETTES.light.routeColor,
      arrows: true,
      arrowScale: 1.5,
      timeLabels: [
        { lat: 46.8721, lng: -114.0012, label: "7:00 PM" },
        { lat: 46.886203, lng: -114.017446, label: "7:12 PM" },
      ],
    });

    const hex = within(studio).getByTestId("route-poster-color-hex");
    await user.clear(hex);
    await user.type(hex, "#aa0011");
    await user.click(within(studio).getByLabelText("Arrows"));
    await user.click(within(studio).getByRole("combobox", { name: "Time labels" }));
    await user.click(await screen.findByRole("option", { name: "Every 5 minutes" }));
    await user.click(within(studio).getByRole("combobox", { name: "Label format" }));
    await user.click(await screen.findByRole("option", { name: "Elapsed" }));

    await waitFor(() => {
      const last = preview.styles.at(-1) as { sources: Record<string, unknown> };
      expect(last.sources[TIME_LABELS_SOURCE]).toMatchObject({
        data: { features: expect.arrayContaining([expect.anything()]) },
      });
      const labels = (
        last.sources[TIME_LABELS_SOURCE] as {
          data: { features: Array<{ properties: { label: string } }> };
        }
      ).data.features.map((feature) => feature.properties.label);
      expect(labels).toEqual(["0m", "5m", "10m", "12m"]);
    });
    const previewStyle = preview.styles.at(-1) as {
      layers: Array<{ id: string; paint?: Record<string, unknown> }>;
    };
    expect(previewStyle.layers.map((l) => l.id)).not.toContain(ARROWS_LAYER);
    expect(previewStyle.layers.find((l) => l.id === "route-line")!.paint!["line-color"]).toBe(
      "#aa0011",
    );

    const previewCalls = vi.mocked(buildPosterStyle).mock.calls.length;
    const previewInput = vi.mocked(buildPosterStyle).mock.calls.at(-1)!;
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await within(studio).findByTestId("route-poster-ready");

    const exportCalls = vi.mocked(buildPosterStyle).mock.calls.slice(previewCalls);
    expect(exportCalls).toHaveLength(1);
    expect(exportCalls[0]).toEqual(previewInput);
    expect(mapOptions[0]!.style).toEqual(previewStyle);
    expect(exportImages[0]).toEqual([ROUTE_ARROW_ICON]);
  });
});

const SAVED_LAYOUT: PosterLayout = {
  ...DEFAULT_LAYOUT,
  routeStyle: {
    colour: "#123456",
    arrows: false,
    arrowScale: 0.75,
    labels: { interval: 5, format: "elapsed", start: null, zone: null },
  },
  elements: [
    { type: "qr", qrId: 100, tag: "qr-001", x: 0.8, y: 0.75, width: 0.15, rotation: 0, z: 1 },
    { type: "image", mediaId: f.mediaAssets[0]!.id!, x: 0.25, y: 0.5, width: 0.3, rotation: 15, z: 0 },
  ],
};

function overlayNames(studio: HTMLElement): string[] {
  return within(studio)
    .queryAllByTestId("poster-overlay-image")
    .map((el) => el.getAttribute("data-name") ?? "");
}

describe("PosterEditor: opening restores the poster document", () => {
  it("restores the theme, orientation, size, terrain, and every route style choice", async () => {
    const user = userEvent.setup();
    terrainProbe.exists = true;
    const { patches } = installFlowHandlers();
    const layout: PosterLayout = {
      version: 1,
      theme: "dark",
      orientation: "portrait",
      size: "flyer",
      terrain: true,
      details: { landmarks: true, placeNames: false, roadLabels: false },
      routeStyle: {
        colour: "#abcdef",
        arrows: true,
        arrowScale: 2,
        labels: { interval: 10, format: "wall", start: "2026-12-21T18:00", zone: "America/Denver" },
      },
      elements: [],
    };
    render(<Harness poster={{ ...POSTER, layout }} />);
    const studio = await openStudio();
    expect(within(studio).getByLabelText("Dark")).toBeChecked();
    expect(within(studio).getByLabelText("Portrait")).toBeChecked();
    expect(within(studio).getByLabelText(/flyer, letter at 300 dpi, 2550 x 3300/i)).toBeChecked();
    expect(await within(studio).findByLabelText("Terrain")).toBeChecked();
    expect(within(studio).getByTestId("route-poster-color-hex")).toHaveValue("#abcdef");
    expect(within(studio).getByLabelText("Arrows")).toBeChecked();
    expect(within(studio).getByLabelText("Landmarks")).toBeChecked();
    expect(within(studio).getByLabelText("Town names")).not.toBeChecked();
    expect(within(studio).getByLabelText("Road labels")).not.toBeChecked();
    expect(within(studio).getByRole("combobox", { name: "Arrow size" })).toHaveTextContent("Extra large");
    expect(within(studio).getByRole("combobox", { name: "Time labels" })).toHaveTextContent(
      "Every 10 minutes",
    );
    expect(within(studio).getByRole("combobox", { name: "Label format" })).toHaveTextContent(
      "Wall clock",
    );
    expect(within(studio).getByTestId("route-poster-start")).toHaveValue("2026-12-21T18:00");
    expect(within(studio).getByRole("combobox", { name: "Timezone" })).toHaveValue("America/Denver");
    expect(within(studio).getByTestId("route-poster-output")).toHaveTextContent(
      "poster-main-street-dark-2550x3300.jpg",
    );
    // The preview draws the restored style: 18:00 in Denver is the first label.
    await waitFor(() => {
      const input = vi.mocked(buildPosterStyle).mock.calls.at(-1)![1];
      expect(input.theme).toBe("dark");
      expect(input.terrain).toBe(true);
      expect(input.options.arrowScale).toBe(2);
      expect(input.options.details).toEqual({ landmarks: true, placeNames: false, roadLabels: false });
      expect(input.options.timeLabels?.[0]?.label).toBe("6:00 PM");
    });

    // Saved back unchanged.
    await user.click(screen.getByTestId("poster-save"));
    await waitFor(() => expect(patches).toEqual([{ name: "Main street", routeId: 4, layout }]));
  });
});

describe("PosterEditor: the overlay composer", () => {
  it("opens with the saved elements and a successful Generate saves them", async () => {
    const user = userEvent.setup();
    const { patches } = installFlowHandlers();
    render(<Harness poster={{ ...POSTER, layout: SAVED_LAYOUT }} />);
    const studio = await openStudio();

    expect(within(studio).getByTestId("route-poster-color-hex")).toHaveValue("#123456");
    expect(within(studio).getByLabelText("Arrows")).not.toBeChecked();
    expect(within(studio).getByRole("combobox", { name: "Arrow size" })).toHaveTextContent("Small");
    expect(within(studio).getByRole("combobox", { name: "Time labels" })).toHaveTextContent(
      "Every 5 minutes",
    );
    // Stacking order: the image (z 0) under the QR code (z 1), placed by
    // fractions of the 480 x 360 preview.
    await waitFor(() => expect(overlayNames(studio)).toEqual(["overlay-image", "overlay-qr"]));
    const [image, qr] = within(studio).getAllByTestId("poster-overlay-image");
    expect(image).toHaveAttribute("data-src", f.mediaAssets[0]!.url);
    expect(Number(image!.getAttribute("data-x"))).toBeCloseTo(0.25 * 480);
    expect(Number(image!.getAttribute("data-y"))).toBeCloseTo(0.5 * 360);
    expect(Number(image!.getAttribute("data-width"))).toBeCloseTo(0.3 * 480);
    expect(image).toHaveAttribute("data-rotation", "15");
    expect(qr!.getAttribute("data-src")).toMatch(/^data:image\/svg\+xml/);

    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await within(studio).findByTestId("route-poster-ready");
    expect(calls.slice(-2)).toEqual(["confirm", "patch"]);
    // Saved in stacking order, each z its index.
    expect(patches).toEqual([
      {
        name: "Main street",
        routeId: 4,
        layout: {
          ...SAVED_LAYOUT,
          elements: [SAVED_LAYOUT.elements[1], SAVED_LAYOUT.elements[0]],
        },
      },
    ]);
  });

  it("draws the map, then the overlays at the print scale, then the attribution", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    const layout: PosterLayout = {
      ...SAVED_LAYOUT,
      elements: [{ type: "logo", mediaId: "logo-1", x: 0.5, y: 0.25, width: 0.2, rotation: 0, z: 0 }],
    };
    render(<Harness poster={{ ...POSTER, layout }} />);
    const studio = await openStudio();
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await within(studio).findByTestId("route-poster-ready");

    const stage = konvaLog.stages.at(-1)!;
    expect(stage.pixelRatio).toBeCloseTo(2048 / OVERLAY_STAGE_WIDTH);
    expect(stage.canvas).toMatchObject({ width: 2048, height: 1536 });
    expect(stage.images).toHaveLength(1);
    expect(stage.images[0]).toMatchObject({ x: 0.5 * OVERLAY_STAGE_WIDTH, width: 0.2 * OVERLAY_STAGE_WIDTH });
    expect(stage.images[0]!.y).toBeCloseTo(0.25 * OVERLAY_STAGE_WIDTH * (1536 / 2048));

    const draws = ctx.drawImage.mock.calls as unknown as unknown[][];
    expect(draws).toHaveLength(2);
    expect(draws[0]![0]).not.toBe(stage.canvas);
    expect(draws[1]![0]).toBe(stage.canvas);
    const attributionAt = ctx.fillText.mock.invocationCallOrder.at(-1)!;
    const [mapAt, overlayAt] = ctx.drawImage.mock.invocationCallOrder;
    expect(mapAt!).toBeLessThan(overlayAt!);
    expect(overlayAt!).toBeLessThan(attributionAt);
    expect(ctx.fillText.mock.calls.at(-1)![0]).toBe(ATTRIBUTION_TEXT);
  });

  it("adds a QR code drawn as a quiet zone card and saves its id and tag", async () => {
    const user = userEvent.setup();
    const { patches } = installFlowHandlers();
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    await user.click(within(studio).getByTestId("poster-overlay-add-qr"));
    const picker = await screen.findByRole("dialog", { name: "Choose a QR code" });
    await user.type(within(picker).getByTestId("poster-qr-search"), "southgate");
    expect(within(picker).queryByText("qr-002")).toBeNull();
    await user.click(within(picker).getByText("qr-001"));

    await waitFor(() => expect(overlayNames(studio)).toEqual(["overlay-qr"]));
    expect(QRCode.toString).toHaveBeenCalledWith(
      "https://site.test/q/qr-001",
      expect.objectContaining({
        type: "svg",
        margin: 4,
        errorCorrectionLevel: "M",
        color: { dark: "#000000ff", light: "#ffffffff" },
      }),
    );
    expect(vi.mocked(loadOverlayImage).mock.calls[0]![0]).toMatch(/^data:image\/svg\+xml/);

    await user.click(screen.getByTestId("poster-save"));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      name: "Main street",
      routeId: 4,
      layout: {
        ...DEFAULT_LAYOUT,
        elements: [{ type: "qr", qrId: 100, tag: "qr-001", x: 0.5, y: 0.5, width: 0.15, rotation: 0, z: 0 }],
      },
    });
  });

  it("offers the site logo only when one is set, and reorders and deletes elements", async () => {
    const user = userEvent.setup();
    const first = render(<Harness poster={POSTER} />);
    let studio = await openStudio();
    await waitFor(() => expect(within(studio).getByTestId("poster-overlay-add-qr")).toBeEnabled());
    expect(within(studio).queryByTestId("poster-overlay-add-logo")).toBeNull();
    first.unmount();

    server.use(
      http.get(`${API}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: { ...(f.siteSettingsDraft.data as object), logoMedia: { mediaId: "logo-1", alt: null } },
        }),
      ),
    );
    render(<Harness poster={POSTER} />);
    studio = await openStudio();
    await user.click(await within(studio).findByTestId("poster-overlay-add-logo"));
    await user.click(within(studio).getByTestId("poster-overlay-add-qr"));
    const picker = await screen.findByRole("dialog", { name: "Choose a QR code" });
    await user.click(within(picker).getByText("qr-002"));
    await waitFor(() => expect(overlayNames(studio)).toEqual(["overlay-logo", "overlay-qr"]));

    // The QR code, added last, is selected: it is at the front.
    expect(within(studio).getByTestId("poster-overlay-forward")).toBeDisabled();
    await user.click(within(studio).getByTestId("poster-overlay-back"));
    expect(overlayNames(studio)).toEqual(["overlay-qr", "overlay-logo"]);
    await user.click(within(studio).getByTestId("poster-overlay-forward"));
    expect(overlayNames(studio)).toEqual(["overlay-logo", "overlay-qr"]);

    // Select the logo and delete it from the keyboard.
    fireEvent.mouseDown(within(studio).getAllByTestId("poster-overlay-image")[0]!);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(overlayNames(studio)).toEqual(["overlay-qr"]);
    expect(within(studio).getByTestId("poster-overlay-delete")).toBeDisabled();
    fireEvent.mouseDown(within(studio).getAllByTestId("poster-overlay-image")[0]!);
    await user.click(within(studio).getByTestId("poster-overlay-delete"));
    expect(overlayNames(studio)).toEqual([]);
  });

  it("Clear overlays removes every element and Save keeps the rest of the design", async () => {
    const user = userEvent.setup();
    const { patches } = installFlowHandlers();
    render(<Harness poster={{ ...POSTER, layout: SAVED_LAYOUT }} />);
    const studio = await openStudio();
    await waitFor(() => expect(overlayNames(studio)).toHaveLength(2));
    await user.click(within(studio).getByTestId("poster-overlay-clear"));
    expect(overlayNames(studio)).toEqual([]);
    await user.click(screen.getByTestId("poster-save"));
    await waitFor(() =>
      expect(patches).toEqual([
        { name: "Main street", routeId: 4, layout: { ...SAVED_LAYOUT, elements: [] } },
      ]),
    );
  });

  it("names a failed or tainted overlay image and keeps the studio usable", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    vi.mocked(loadOverlayImage).mockImplementation(async (url: string) => {
      if (url === f.mediaAssets[0]!.url) {
        throw new Error("The image host does not allow the image on a canvas (no cross-origin access).");
      }
      const image = document.createElement("img");
      image.src = url;
      return { image, aspect: 1 };
    });
    render(<Harness poster={{ ...POSTER, layout: SAVED_LAYOUT }} />);
    const studio = await openStudio();
    expect(await within(studio).findByTestId("poster-overlay-failed")).toHaveTextContent(
      "The overlay image hangar.jpg could not load. The image host does not allow the image on a canvas",
    );
    expect(within(studio).getAllByTestId("poster-overlay-placeholder")).toHaveLength(1);

    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    expect(await within(studio).findByTestId("route-poster-error")).toHaveTextContent(
      "The overlay image hangar.jpg could not be drawn. The image host does not allow the image on a canvas",
    );
    expect(calls).not.toContain("render");
    expect(calls).not.toContain("upload-url");
    expect(within(studio).getByTestId("route-poster-generate-run")).toBeEnabled();
    expect(within(studio).getByTestId("route-poster-generate-run")).toHaveTextContent(/try again/i);
    await user.click(screen.getByTestId("poster-back"));
    expect(await screen.findByTestId("posters-page")).toBeInTheDocument();
  });
});

describe("PosterEditor: no attach to an event", () => {
  it("renders no attach control before or after Generate and sends no event PATCH", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    const eventPatches: unknown[] = [];
    server.use(
      http.patch(`${API}/admin/events/:id`, async ({ request }) => {
        eventPatches.push(await request.json());
        return HttpResponse.json(f.events[0]);
      }),
    );
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    expect(within(studio).queryByTestId("poster-attach")).toBeNull();
    await user.click(within(studio).getByTestId("route-poster-generate-run"));
    await within(studio).findByTestId("route-poster-ready");
    expect(screen.queryByTestId("poster-attach")).toBeNull();
    expect(screen.queryByTestId("poster-attach-run")).toBeNull();
    expect(screen.queryByRole("button", { name: /attach to an event/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Event" })).toBeNull();
    expect(eventPatches).toEqual([]);
  });
});

describe("PosterEditor help buttons (admin.md 6.26)", () => {
  it("mounts the header help and every group help of the default render", async () => {
    render(<Harness poster={POSTER} />);
    const studio = await openStudio();
    expect(screen.getByTestId("help-posters.editor")).toBeInTheDocument();
    for (const key of [
      "posters.editor.size",
      "posters.editor.map-details",
      "posters.editor.route-styling",
      "posters.editor.overlays",
      "posters.editor.generate",
    ]) {
      expect(within(studio).getByTestId(`help-${key}`)).toBeInTheDocument();
    }
  });
});
