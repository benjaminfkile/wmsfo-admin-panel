import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import IconPicker from "./IconPicker";
import { ConfigProvider } from "../../../ConfigContext";
import { NotifyProvider } from "../../../hooks/useNotify";
import { installClient } from "../../../api/client";
import { buildTheme } from "../../../theme/theme";
import { server } from "../../../test/msw/server";
import * as f from "../../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../../test/renderWithProviders";
import type { Icon, IconInfo, MediaAsset } from "../../../api/types";

function Harness({
  onPick,
  onCancel,
}: {
  onPick: (icon: Icon) => void;
  onCancel: () => void;
}) {
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
          <MemoryRouter initialEntries={["/"]}>
            <NotifyProvider>
              <IconPicker open onPick={onPick} onCancel={onCancel} />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const PNG_MAGIC = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function bytesToBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

let xhrCreated: FakeXhr[] = [];

type FakeXhrEvent = { loaded: number; total: number; lengthComputable: boolean };

class FakeXhr {
  method = "";
  url = "";
  headers: Record<string, string> = {};
  status = 200;
  responseText = "";
  upload: {
    onprogress: ((e: FakeXhrEvent) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  send(_body: Blob | ArrayBuffer | File): void {
    xhrCreated.push(this);
  }
  respond(status: number): void {
    this.status = status;
    if (this.upload.onprogress) {
      this.upload.onprogress({ loaded: 100, total: 100, lengthComputable: true });
    }
    this.onload?.();
  }
}

beforeEach(() => {
  xhrCreated = [];
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllGlobals();
});

describe("IconPicker: library tab", () => {
  it("filters the library by the search box and shows the icon image", async () => {
    const user = userEvent.setup();
    const bigLibrary: IconInfo[] = [
      { id: "cookie", name: "Cookie", tags: ["food"], url: "https://cdn.test/i/cookie.svg" },
      { id: "leaf", name: "Leaf", tags: ["plant"], url: "https://cdn.test/i/leaf.svg" },
    ];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/icons`, () =>
        HttpResponse.json({ items: bigLibrary })
      )
    );
    render(<Harness onPick={() => undefined} onCancel={() => undefined} />);
    // Both tiles appear first.
    const cookieTile = await screen.findByTestId("icon-tile-cookie");
    await screen.findByTestId("icon-tile-leaf");
    // The tile carries the icon's image.
    const img = cookieTile.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://cdn.test/i/cookie.svg");
    // Search narrows the grid.
    const search = screen.getByLabelText(/search icons/i);
    await user.type(search, "leaf");
    await waitFor(() =>
      expect(screen.queryByTestId("icon-tile-cookie")).toBeNull()
    );
    expect(screen.getByTestId("icon-tile-leaf")).toBeInTheDocument();
  });

  it("emits { source: 'library', id } when a tile is picked with Choose", async () => {
    const user = userEvent.setup();
    const picks: Icon[] = [];
    render(
      <Harness
        onPick={(icon) => picks.push(icon)}
        onCancel={() => undefined}
      />
    );
    const tile = await screen.findByTestId("icon-tile-cookie");
    await user.click(tile);
    const buttons = screen.getAllByRole("button", { name: /^choose$/i });
    // The last "Choose" button is the picker's action.
    await user.click(buttons[buttons.length - 1]!);
    expect(picks).toEqual([{ source: "library", id: "cookie" }]);
  });
});

describe("IconPicker: media library tab", () => {
  it("lists ready assets of every kind and picks emit { source: 'media', id }", async () => {
    const user = userEvent.setup();
    const kinds: (string | null)[] = [];
    const states: (string | null)[] = [];
    const svgAsset: MediaAsset = {
      ...f.mediaAssets[0]!,
      id: "svg-asset",
      kind: "svg",
      filename: "logo.svg",
    };
    const gifAsset: MediaAsset = {
      ...f.mediaAssets[0]!,
      id: "gif-asset",
      kind: "gif",
      filename: "spin.gif",
    };
    const rasterAsset: MediaAsset = {
      ...f.mediaAssets[0]!,
      id: "raster-asset",
      kind: "raster",
      filename: "photo.jpg",
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media`, ({ request }) => {
        const url = new URL(request.url);
        kinds.push(url.searchParams.get("kind"));
        states.push(url.searchParams.get("state"));
        return HttpResponse.json({
          items: [svgAsset, gifAsset, rasterAsset],
          nextCursor: null,
        });
      })
    );
    const picks: Icon[] = [];
    render(
      <Harness onPick={(icon) => picks.push(icon)} onCancel={() => undefined} />
    );
    await user.click(screen.getByRole("tab", { name: /media library/i }));
    await screen.findByTestId("media-card-svg-asset");
    // Every kind is listed; the request carries no kind filter.
    expect(screen.getByTestId("media-card-svg-asset")).toBeInTheDocument();
    expect(screen.getByTestId("media-card-gif-asset")).toBeInTheDocument();
    expect(screen.getByTestId("media-card-raster-asset")).toBeInTheDocument();
    for (const kind of kinds) expect(kind).toBeNull();
    for (const state of states) expect(state).toBe("ready");
    // Pick the raster card and confirm.
    const card = screen.getByTestId("media-card-raster-asset");
    const clickable = card.querySelector("button")!;
    await user.click(clickable);
    const buttons = screen.getAllByRole("button", { name: /^choose$/i });
    await user.click(buttons[buttons.length - 1]!);
    expect(picks).toEqual([{ source: "media", id: "raster-asset" }]);
  });
});

describe("IconPicker: upload tab", () => {
  it("emits the media icon and stops on ready", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/media/upload-url`,
        () =>
          HttpResponse.json(
            {
              ...f.uploadTicket,
              uploadUrl: "https://s3.example/put",
              media: { ...f.mediaAssets[0], id: "uploaded-id" },
            },
            { status: 201 }
          )
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/media/uploaded-id/confirm`,
        () =>
          HttpResponse.json({
            ...f.mediaAssets[0],
            id: "uploaded-id",
            state: "ready",
          })
      )
    );
    const picks: Icon[] = [];
    render(
      <Harness onPick={(icon) => picks.push(icon)} onCancel={() => undefined} />
    );
    await user.click(screen.getByRole("tab", { name: /^upload$/i }));
    const input = await screen.findByTestId<HTMLInputElement>(
      "media-file-input"
    );
    const file = new File([bytesToBuffer(PNG_MAGIC)], "hero.png", {
      type: "image/png",
    });
    await user.upload(input, file);
    await waitFor(() => expect(xhrCreated.length).toBeGreaterThan(0));
    await act(async () => xhrCreated[0]!.respond(200));
    await waitFor(() => expect(picks.length).toBe(1));
    expect(picks[0]).toEqual({ source: "media", id: "uploaded-id" });
  });
});
