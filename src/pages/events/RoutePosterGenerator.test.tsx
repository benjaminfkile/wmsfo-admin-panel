import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import RoutePosterSection from "./RoutePosterSection";
import { SIZE_LIMIT_MESSAGE } from "./RoutePosterGenerator";
import { ConfigProvider } from "../../ConfigContext";
import type { Config } from "../../config";
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
import { ATTRIBUTION_TEXT, resetTerrainProbes } from "../../routeMap/poster";
import { HILLSHADE_LAYER, TERRAIN_SOURCE } from "../../routeMap";

vi.setConfig({ testTimeout: 15_000 });

// Every step of the flow appends here so the tests can check the order.
const calls: string[] = [];
const mapOptions: Array<{ pixelRatio: number; style: unknown }> = [];

vi.mock("maplibre-gl", () => {
  class Map {
    private canvas = document.createElement("canvas");
    constructor(opts: { container: HTMLElement; pixelRatio: number; style: unknown }) {
      calls.push("render");
      mapOptions.push(opts);
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
    getCanvas() {
      return this.canvas;
    }
    remove() {
      return undefined;
    }
  }
  return { Map, addProtocol: () => undefined, setWorkerUrl: () => undefined };
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
const EVENT: Event = { ...f.events[0]!, routeImageMediaId: null };
const READY_ASSET = {
  ...f.mediaAssets[0]!,
  id: "poster-asset-1",
  filename: "route-poster-2026-light-2048x1536.png",
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

function Harness({ event, config = testConfig }: { event: Event; config?: Config }) {
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
          <MemoryRouter>
            <NotifyProvider>
              <RoutePosterSection event={event} />
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
    http.get(`${API}/admin/events/:id/route-map`, () => {
      calls.push("route-map");
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
    http.patch(`${API}/admin/events/:id`, async ({ request }) => {
      calls.push("patch");
      patches.push(await request.json());
      return HttpResponse.json({ ...EVENT, routeImageMediaId: READY_ASSET.id });
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
  mapOptions.length = 0;
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
});

afterEach(() => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

describe("RoutePosterSection: Generate from flight recording", () => {
  it("is disabled with a hint when the event has no linked recording", () => {
    render(<Harness event={{ ...EVENT, routeId: null }} />);
    expect(screen.getByTestId("route-poster-generate")).toBeDisabled();
    expect(screen.getByTestId("route-poster-generate-hint")).toHaveTextContent(
      /link a flight recording/i,
    );
  });

  it("is disabled with a hint when VITE_ROUTE_BASEMAP_URL is unset", () => {
    render(<Harness event={EVENT} config={{ ...testConfig, routeBasemapUrl: "" }} />);
    expect(screen.getByTestId("route-poster-generate")).toBeDisabled();
    expect(screen.getByTestId("route-poster-generate-hint")).toHaveTextContent(
      /VITE_ROUTE_BASEMAP_URL/,
    );
  });

  it("lists the presets and swaps the pair with the orientation", async () => {
    const user = userEvent.setup();
    render(<Harness event={EVENT} />);
    expect(screen.queryByTestId("route-poster-generate-hint")).toBeNull();
    await user.click(screen.getByTestId("route-poster-generate"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/facebook post, 2048 x 1536/i)).toBeChecked();
    expect(within(dialog).getByLabelText(/flyer, letter at 300 dpi, 3300 x 2550/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/poster, 11 x 17 at 300 dpi, 5100 x 3300/i)).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Portrait"));
    expect(within(dialog).getByLabelText(/facebook post, 1536 x 2048/i)).toBeChecked();
    expect(within(dialog).getByLabelText(/flyer, letter at 300 dpi, 2550 x 3300/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/poster, 11 x 17 at 300 dpi, 3300 x 5100/i)).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Dark"));
    await user.click(within(dialog).getByLabelText(/flyer/i));
    expect(within(dialog).getByTestId("route-poster-output")).toHaveTextContent(
      "route-poster-2026-dark-2550x3300.png",
    );
  });

  it("drives render, compose, upload, confirm, ready, and set as poster in order", async () => {
    const user = userEvent.setup();
    const { uploadBodies, patches } = installFlowHandlers();
    render(<Harness event={EVENT} />);
    await user.click(screen.getByTestId("route-poster-generate"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId("route-poster-generate-run"));

    await within(dialog).findByTestId("route-poster-ready");
    expect(calls).toEqual(["route-map", "render", "compose", "encode", "upload-url", "put", "confirm"]);
    expect(mapOptions[0]!.pixelRatio).toBe(2);
    expect(ctx.fillText).toHaveBeenCalledWith(
      ATTRIBUTION_TEXT,
      expect.any(Number),
      expect.any(Number),
    );
    expect(uploadBodies[0]).toMatchObject({
      filename: "route-poster-2026-light-2048x1536.png",
      contentType: "image/png",
      sizeBytes: 4,
    });
    expect(within(dialog).getByTestId("route-poster-media-link")).toHaveAttribute(
      "href",
      "/media?id=poster-asset-1",
    );

    await user.click(within(dialog).getByTestId("route-poster-set"));
    await waitFor(() => expect(patches).toEqual([{ routeImageMediaId: "poster-asset-1" }]));
    expect(calls.at(-1)).toBe("patch");
  });

  it("a 413 from the upload surfaces a readable message and the dialog stays usable", async () => {
    const user = userEvent.setup();
    installFlowHandlers({ uploadUrlStatus: 413 });
    render(<Harness event={EVENT} />);
    await user.click(screen.getByTestId("route-poster-generate"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId("route-poster-generate-run"));
    expect(await within(dialog).findByTestId("route-poster-error")).toHaveTextContent(
      SIZE_LIMIT_MESSAGE,
    );
    expect(within(dialog).getByTestId("route-poster-generate-run")).toBeEnabled();
    expect(within(dialog).getByTestId("route-poster-generate-run")).toHaveTextContent(/try again/i);
    expect(within(dialog).getByLabelText("Dark")).toBeEnabled();
    expect(calls).not.toContain("put");
  });

  it("a render failure surfaces a readable message", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/admin/events/:id/route-map`, () =>
        HttpResponse.json({ routeMap: null }),
      ),
    );
    render(<Harness event={EVENT} />);
    await user.click(screen.getByTestId("route-poster-generate"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId("route-poster-generate-run"));
    expect(await within(dialog).findByTestId("route-poster-error")).toHaveTextContent(
      /could not be drawn.*no path/i,
    );
    expect(within(dialog).getByTestId("route-poster-generate-run")).toBeEnabled();
  });

  it("hides the Terrain checkbox when the terrain archive is missing", async () => {
    const user = userEvent.setup();
    installFlowHandlers();
    render(<Harness event={EVENT} />);
    await user.click(screen.getByTestId("route-poster-generate"));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(terrainProbe.urls).toEqual([`${testConfig.routeBasemapUrl}/terrain.pmtiles`]),
    );
    expect(within(dialog).queryByLabelText("Terrain")).toBeNull();
    await user.click(within(dialog).getByTestId("route-poster-generate-run"));
    await within(dialog).findByTestId("route-poster-ready");
    const style = mapOptions[0]!.style as { sources: Record<string, unknown> };
    expect(style.sources[TERRAIN_SOURCE]).toBeUndefined();
  });

  it("offers Terrain unchecked when the archive exists and draws the hillshade when checked", async () => {
    const user = userEvent.setup();
    terrainProbe.exists = true;
    installFlowHandlers();
    render(<Harness event={EVENT} />);
    await user.click(screen.getByTestId("route-poster-generate"));
    const dialog = await screen.findByRole("dialog");
    const box = await within(dialog).findByLabelText("Terrain");
    expect(box).not.toBeChecked();

    await user.click(within(dialog).getByTestId("route-poster-generate-run"));
    await within(dialog).findByTestId("route-poster-ready");
    const plain = mapOptions[0]!.style as {
      sources: Record<string, unknown>;
      layers: Array<{ id: string }>;
    };
    expect(plain.sources[TERRAIN_SOURCE]).toBeUndefined();
    expect(plain.layers.map((l) => l.id)).not.toContain(HILLSHADE_LAYER);

    await user.click(within(dialog).getByLabelText("Terrain"));
    expect(within(dialog).getByLabelText("Terrain")).toBeChecked();
    await user.click(within(dialog).getByTestId("route-poster-generate-run"));
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
});
