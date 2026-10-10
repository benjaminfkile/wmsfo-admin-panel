// admin.md 6.28, 9.2: the theme editor. The renderer radio, the key and
// name rules, the style file check, the two previews, Render thumbnail,
// the contrast readout, the chrome strip, the default switches, the
// sprite zone, and Save on create and on edit.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ThemeEditorDialog from "./ThemeEditorDialog";
import { BASEMAP_NOTE } from "./ThemePreview";
import { KEY_RULE } from "./themeForm";
import { readText } from "./readFile";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import { makeFakeUserManager, makeUser, testConfig } from "../../test/renderWithProviders";
import lightStyle from "../../../contracts/fixtures/themes/light.json";
import standard from "../../../contracts/fixtures/themes/standard.json";
import { themes as themesApi } from "../../api/resources/themes";
import type { Config } from "../../config";
import type { TrackerTheme } from "../../api/types";

const maps = vi.hoisted(() => ({
  created: [] as Array<Record<string, unknown>>,
  styles: [] as unknown[],
  captured: 0,
}));

vi.mock("maplibre-gl", () => {
  class Map {
    constructor(opts: Record<string, unknown>) {
      maps.created.push(opts);
    }
    on() {
      return this;
    }
    once() {
      return this;
    }
    loaded() {
      return true;
    }
    setStyle(style: unknown) {
      maps.styles.push(style);
    }
    getCanvas() {
      return {
        toBlob: (cb: (b: Blob | null) => void) => {
          maps.captured += 1;
          cb(new Blob(["png"], { type: "image/png" }));
        },
      };
    }
    addImage() {
      return undefined;
    }
    hasImage() {
      return true;
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
  PMTiles: class {},
}));

const google = vi.hoisted(() => ({
  keys: [] as string[],
  maps: [] as Array<Record<string, unknown>>,
  lines: [] as Array<Record<string, unknown>>,
}));

vi.mock("../places/googleMaps", () => ({
  loadMaps: (key: string) => {
    google.keys.push(key);
    return Promise.resolve({
      Map: class {
        constructor(_el: unknown, opts: Record<string, unknown>) {
          google.maps.push(opts);
        }
        setOptions() {
          return undefined;
        }
      },
      Polyline: class {
        constructor(opts: Record<string, unknown>) {
          google.lines.push(opts);
        }
        setOptions() {
          return undefined;
        }
        setMap() {
          return undefined;
        }
      },
    });
  },
}));

const puts = vi.hoisted(
  () => [] as Array<{ url: string | undefined; headers: unknown; name: string }>,
);
vi.mock("../../api/resources/upload", () => ({
  UploadFailed: class extends Error {},
  uploadToS3: (ticket: { uploadUrl?: string; headers?: unknown }, file: File) => {
    puts.push({ url: ticket.uploadUrl, headers: ticket.headers, name: file.name });
    return Promise.resolve();
  },
}));

const API = testConfig.apiBaseUrl;

function byKey(key: string): TrackerTheme {
  return f.trackerThemes.find((t) => t.key === key)!;
}

function Harness({
  theme,
  onClose = () => undefined,
  config = testConfig,
}: {
  theme: TrackerTheme | null;
  onClose?: () => void;
  config?: Config;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ConfigProvider config={config}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <NotifyProvider>
              <ThemeEditorDialog theme={theme} onClose={onClose} />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

// Every write the dialog sends, in order.
let writes: Array<{ method: string; path: string }> = [];

beforeEach(() => {
  maps.created.length = 0;
  maps.styles.length = 0;
  maps.captured = 0;
  google.keys.length = 0;
  google.maps.length = 0;
  google.lines.length = 0;
  puts.length = 0;
  writes = [];
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] }),
    ),
    onMfaRequired: () => undefined,
  });
  server.events.on("request:start", ({ request }) => {
    if (request.method !== "GET") {
      writes.push({ method: request.method, path: new URL(request.url).pathname });
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  server.events.removeAllListeners();
  server.resetHandlers();
});

function jsonFile(body: unknown, name: string): File {
  return new File([JSON.stringify(body)], name, { type: "application/json" });
}

async function dropStyle(user: ReturnType<typeof userEvent.setup>, body: unknown, name = "style.json") {
  await user.upload(screen.getByTestId<HTMLInputElement>("style-file-input"), jsonFile(body, name));
}

async function fillKeyAndName(user: ReturnType<typeof userEvent.setup>, key: string, name: string) {
  await user.type(screen.getByRole("textbox", { name: /^key/i }), key);
  await user.type(screen.getByRole("textbox", { name: /^name/i }), name);
}

function field(name: string): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
}

describe("ThemeEditorDialog", () => {
  it("offers the renderer radio on create and fixes it on edit, with its seven help keys", async () => {
    const { unmount } = render(<Harness theme={null} />);
    const dialog = await screen.findByRole("dialog", { name: "New theme" });
    expect(within(dialog).getByRole("radio", { name: "Google Maps" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "MapLibre" })).toBeChecked();
    for (const key of [
      "themes.editor",
      "themes.style-file",
      "themes.sprite",
      "themes.chrome",
      "themes.overlay",
      "themes.thumbnail",
      "themes.defaults",
    ]) {
      expect(within(dialog).getByTestId(`help-${key}`)).toBeInTheDocument();
    }
    unmount();

    render(<Harness theme={byKey("night")} />);
    const edit = await screen.findByRole("dialog", { name: "Edit Night" });
    expect(within(edit).queryByRole("radio")).toBeNull();
    expect(within(edit).getByTestId("theme-renderer")).toHaveTextContent("Renderer: Google Maps");
  });

  it("holds Save to the key and name rules", async () => {
    const user = userEvent.setup();
    render(<Harness theme={null} />);
    await screen.findByRole("dialog");
    expect(
      screen.getByText(
        "What a visitor's saved choice names. Changing it sends those visitors back to the default.",
      ),
    ).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /^key/i }), "1Bad");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(KEY_RULE)).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Choose a style file")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /^name/i }), "x".repeat(61));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Name must be 60 characters or fewer")).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("previews a Google file through the Google loader, with the thumbnail upload only", async () => {
    const user = userEvent.setup();
    render(<Harness theme={null} />);
    await user.click(await screen.findByRole("radio", { name: "Google Maps" }));
    expect(screen.queryByTestId("sprite-drop-zone")).toBeNull();
    await dropStyle(user, standard);
    expect(await screen.findByTestId("style-summary")).toHaveTextContent(
      `${standard.length} rules`,
    );
    await waitFor(() => expect(google.maps).toHaveLength(1));
    expect(google.keys).toEqual([testConfig.googleMapsKey]);
    expect(google.maps[0]!.styles).toEqual(standard);
    expect(google.lines[0]!.path).toHaveLength(9);
    expect(screen.getByRole("button", { name: "Choose from the media library" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Render thumbnail" })).toBeNull();
    expect(maps.created).toHaveLength(0);
  });

  it("refuses a MapLibre file with its reason and previews a valid one at two zooms", async () => {
    const user = userEvent.setup();
    render(<Harness theme={null} />);
    await screen.findByRole("dialog");
    await dropStyle(user, { ...lightStyle, version: 7 });
    expect(await screen.findByTestId("style-error")).toHaveTextContent(
      "The style's version must be 8.",
    );
    expect(maps.created).toHaveLength(0);

    await dropStyle(user, lightStyle);
    expect(await screen.findByTestId("style-summary")).toHaveTextContent(
      `${lightStyle.layers.length} layers`,
    );
    await waitFor(() => expect(maps.created).toHaveLength(2));
    expect(maps.created.map((m) => m.zoom)).toEqual([11, 14]);
    for (const opts of maps.created) {
      expect(opts.interactive).toBe(false);
      const style = opts.style as {
        sources: Record<string, { url?: string; data?: unknown }>;
        layers: Array<{ id: string }>;
      };
      expect(style.sources.basemap!.url).toBe("pmtiles://https://basemap.test/tiles.pmtiles");
      expect(style.sources.terrain!.url).toBe("pmtiles://https://basemap.test/terrain.pmtiles");
      expect(style.sources["preview-route"]).toBeDefined();
      const ids = style.layers.map((l) => l.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          "preview-route-line",
          "preview-route-arrows",
          "preview-time-labels",
          "preview-user",
        ]),
      );
    }
    expect(screen.getAllByTestId("chrome-strip")).toHaveLength(2);
  });

  it("shows the note without VITE_ROUTE_BASEMAP_URL and still saves", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness theme={null} onClose={onClose} config={{ ...testConfig, routeBasemapUrl: "" }} />);
    await screen.findByRole("dialog");
    await dropStyle(user, lightStyle);
    expect(await screen.findByText(BASEMAP_NOTE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Render thumbnail" })).toBeDisabled();
    await fillKeyAndName(user, "candy-cane", "Candy cane");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(maps.created).toHaveLength(0);
  });

  it("Render thumbnail captures the canvas and runs the ticket, PUT, confirm sequence into the field", async () => {
    let ticket: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API}/admin/media/upload-url`, async ({ request }) => {
        ticket = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            ...f.uploadTicket,
            uploadUrl: "https://s3.example/thumb",
            media: { ...f.mediaAssets[0], id: "thumb-1" },
          },
          { status: 201 },
        );
      }),
      http.post(`${API}/admin/media/thumb-1/confirm`, () =>
        HttpResponse.json({ ...f.mediaAssets[0], id: "thumb-1", state: "ready" }),
      ),
    );
    const user = userEvent.setup();
    render(<Harness theme={null} />);
    await screen.findByRole("dialog");
    await fillKeyAndName(user, "candy-cane", "Candy cane");
    await dropStyle(user, lightStyle);
    await waitFor(() => expect(maps.created).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "Render thumbnail" }));
    await waitFor(() =>
      expect(screen.getByTestId("thumbnail-value")).toHaveAttribute("data-media-id", "thumb-1"),
    );
    expect(maps.captured).toBe(1);
    expect(ticket).toEqual({
      filename: "theme-candy-cane.png",
      contentType: "image/png",
      sizeBytes: 3,
      alt: "Candy cane tracker theme",
      title: "Candy cane",
    });
    expect(puts).toEqual([
      { url: "https://s3.example/thumb", headers: f.uploadTicket.headers, name: "theme-candy-cane.png" },
    ]);
    expect(writes.map((w) => w.path)).toEqual([
      "/admin/media/upload-url",
      "/admin/media/thumb-1/confirm",
    ]);
  });

  it("reads out the contrast per pair and a failing pair blocks Save", async () => {
    render(<Harness theme={byKey("light")} />);
    await screen.findByRole("dialog");
    const text = screen.getByTestId("contrast-text");
    const tile = screen.getByTestId("contrast-tileFg");
    expect(text).toHaveTextContent(/^Text on background \d+\.\d\d:1$/);
    expect(text).toHaveAttribute("data-pass", "true");
    expect(tile).toHaveTextContent(/^Tile text on tile \d+\.\d\d:1$/);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    fireEvent.change(field("chrome.tileFg"), { target: { value: "#c0c8d0" } });
    expect(tile).toHaveAttribute("data-pass", "false");
    expect(tile).toHaveTextContent("4.5:1 or better is required");
    expect(text).toHaveAttribute("data-pass", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("repaints the chrome strip on a colour change", async () => {
    render(<Harness theme={byKey("light")} />);
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.getAllByTestId("chrome-strip")).toHaveLength(2));
    expect(screen.getAllByTestId("chrome-pill")[0]).toHaveAttribute("data-bg", "#ffffff");
    fireEvent.change(field("chrome.bg"), { target: { value: "#fafafa" } });
    for (const pill of screen.getAllByTestId("chrome-pill")) {
      expect(pill).toHaveAttribute("data-bg", "#fafafa");
    }
    fireEvent.change(field("chrome.accent"), { target: { value: "#00ff00" } });
    expect(screen.getAllByTestId("chrome-accent")[0]).toHaveAttribute("data-accent", "#00ff00");
    // An overlay change repaints the map through setStyle.
    fireEvent.change(field("overlay.routeColor"), { target: { value: "#ff0000" } });
    await waitFor(() => expect(maps.styles.length).toBeGreaterThan(0));
  });

  it("names the default holder and posts /default only when flipped", async () => {
    let flags: unknown = null;
    server.use(
      http.post(`${API}/admin/themes/:id/default`, async ({ request }) => {
        flags = await request.json();
        return HttpResponse.json(byKey("dark"));
      }),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(<Harness theme={byKey("dark")} onClose={onClose} />);
    await screen.findByRole("dialog");
    const light = screen.getByRole("switch", { name: "Default in light mode" });
    const dark = screen.getByRole("switch", { name: "Default in dark mode" });
    expect(dark).toBeChecked();
    // Dark already holds the dark flag: no caption.
    expect(screen.queryByTestId("default-dark-caption")).toBeNull();
    await user.click(light);
    expect(screen.getByTestId("default-light-caption")).toHaveTextContent(
      "Replaces Light as the light default",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(flags).toEqual({ light: true });
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual(["POST /admin/themes/2/default"]);
    unmount();

    writes = [];
    const closed = vi.fn();
    render(<Harness theme={byKey("dark")} onClose={closed} />);
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(closed).toHaveBeenCalled());
    expect(writes).toEqual([]);
  });

  it("takes the four sprite files and posts the tickets, the PUTs, then the confirm", async () => {
    let ticketBody: { indexSha256: string } | null = null;
    let confirmBody: { indexSha256: string } | null = null;
    server.use(
      http.post(`${API}/admin/themes/:id/sprite`, async ({ request, params }) => {
        ticketBody = (await request.json()) as { indexSha256: string };
        return HttpResponse.json(f.spriteTickets(Number(params.id), ticketBody.indexSha256), {
          status: 201,
        });
      }),
      http.post(`${API}/admin/themes/:id/sprite/confirm`, async ({ request }) => {
        confirmBody = (await request.json()) as { indexSha256: string };
        return HttpResponse.json(byKey("light"));
      }),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness theme={byKey("light")} onClose={onClose} />);
    await screen.findByRole("dialog");
    const input = screen.getByTestId<HTMLInputElement>("sprite-file-input");
    await user.upload(input, [jsonFile({ pin: { x: 0 } }, "sprite.json")]);
    expect(await screen.findByTestId("sprite-error")).toHaveTextContent(/four files/);
    const png = (name: string) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
    await user.upload(input, [
      jsonFile({ pin: { x: 0 } }, "sprite.json"),
      png("sprite.png"),
      jsonFile({ pin: { x: 0, pixelRatio: 2 } }, "sprite@2x.json"),
      png("sprite@2x.png"),
    ]);
    expect(await screen.findByTestId("sprite-summary")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(ticketBody!.indexSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(confirmBody).toEqual(ticketBody);
    expect(writes.map((w) => w.path)).toEqual([
      "/admin/themes/1/sprite",
      "/admin/themes/1/sprite/confirm",
    ]);
    expect(puts.map((p) => p.name).sort()).toEqual([
      "sprite.json",
      "sprite.png",
      "sprite@2x.json",
      "sprite@2x.png",
    ]);
    for (const p of puts) {
      expect(p.url).toContain(`/sprites/${ticketBody!.indexSha256}/`);
      expect(p.headers).toMatchObject({ "x-amz-tagging": "state=pending" });
    }
  });

  it("shows Sprite: 4 files and Replace on a theme that has one", async () => {
    const user = userEvent.setup();
    render(<Harness theme={{ ...byKey("light"), spriteSha256: "a".repeat(64) }} />);
    expect(await screen.findByTestId("sprite-current")).toHaveTextContent("Sprite: 4 files");
    await user.click(screen.getByRole("button", { name: "Replace" }));
    expect(screen.getByTestId("sprite-drop-zone")).toBeInTheDocument();
  });

  it("saves a new theme as multipart with the next free sortOrder", async () => {
    // The test DOM's File body never streams through fetch, and the content
    // type the test fetch stamps on a FormData body is the environment's,
    // so the form is read from the call (the client sends a FormData body
    // with no header and the browser sets the multipart type) and the
    // handler answers 201.
    const createForm = vi.spyOn(themesApi, "createForm");
    server.use(
      http.post(`${API}/admin/themes`, () =>
        HttpResponse.json({ ...byKey("light"), id: 42 }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness theme={null} onClose={onClose} />);
    await screen.findByRole("dialog");
    await fillKeyAndName(user, "candy-cane", "Candy cane");
    // A Maputnik export: the seed with the glyph template, a sprite, and
    // the source URLs the editor wrote into it.
    const exported = {
      ...lightStyle,
      glyphs: "https://example.invalid/glyphs/{fontstack}/{range}.pbf",
      sprite: "https://example.invalid/sprite",
      sources: {
        basemap: { ...lightStyle.sources.basemap, url: "pmtiles://https://example.invalid/tiles.pmtiles" },
        terrain: { ...lightStyle.sources.terrain, url: "pmtiles://https://example.invalid/terrain.pmtiles" },
      },
    };
    await dropStyle(user, exported, "candy.json");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText("Theme saved")).toBeInTheDocument();
    expect(createForm).toHaveBeenCalledTimes(1);
    const fd = createForm.mock.calls[0]![0];
    expect(fd.get("renderer")).toBe("maplibre");
    expect(fd.get("key")).toBe("candy-cane");
    expect(fd.get("name")).toBe("Candy cane");
    // The MapLibre group holds 10 and 20.
    expect(fd.get("sortOrder")).toBe("30");
    expect(JSON.parse(fd.get("chrome") as string)).toEqual(byKey("light").chrome);
    expect(JSON.parse(fd.get("overlay") as string)).toEqual(byKey("light").overlay);
    // The file part is the checked document: what the API and the map own
    // is gone, so the export goes up as it was dropped.
    const style = fd.get("style") as File;
    expect(style.name).toBe("candy.json");
    expect(JSON.parse(await readText(style))).toEqual(lightStyle);
    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual(["POST /admin/themes"]);
  });

  it("patches only the changed fields on edit", async () => {
    let body: unknown = null;
    server.use(
      http.patch(`${API}/admin/themes/:id`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(byKey("night"));
      }),
    );
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness theme={byKey("night")} onClose={onClose} />);
    await screen.findByRole("dialog");
    const name = screen.getByRole("textbox", { name: /^name/i });
    await user.clear(name);
    await user.type(name, "Midnight");
    fireEvent.change(field("overlay.userColor"), { target: { value: "#ff0000" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toEqual({
      name: "Midnight",
      overlay: { ...byKey("night").overlay, userColor: "#ff0000" },
    });
  });

  it("lands a 409 on the Key field", async () => {
    server.use(
      http.post(`${API}/admin/themes`, () =>
        HttpResponse.json(
          { code: "key_taken", message: "Key taken", details: null, requestId: "r1" },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<Harness theme={null} />);
    await screen.findByRole("dialog");
    await fillKeyAndName(user, "candy-cane", "Candy cane");
    await dropStyle(user, lightStyle);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("A MapLibre theme with this key exists")).toBeInTheDocument();
  });

  it("lands a 400 validation_failed on the field its path names", async () => {
    server.use(
      http.patch(`${API}/admin/themes/:id`, () =>
        HttpResponse.json(
          {
            code: "validation_failed",
            message: "Invalid",
            details: { fields: { "chrome.panel": "Use #rrggbb or #rrggbbaa" } },
            requestId: "r1",
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<Harness theme={byKey("night")} />);
    await screen.findByRole("dialog");
    fireEvent.change(field("chrome.panel"), { target: { value: "#000000" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(field("chrome.panel")).toHaveAttribute("aria-invalid", "true"),
    );
  });

  it("closes on Cancel without a request", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness theme={byKey("light")} onClose={onClose} />);
    await screen.findByRole("dialog");
    await user.type(screen.getByRole("textbox", { name: /^name/i }), " changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});
