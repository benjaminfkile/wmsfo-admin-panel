import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import MediaLibrary from "./MediaLibrary";
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
          <MemoryRouter initialEntries={["/media"]}>
            <NotifyProvider>
              <MediaLibrary />
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

const SVG_TEXT = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
);

function fillTo(bytes: Uint8Array, targetSize: number): ArrayBuffer {
  const buf = new ArrayBuffer(targetSize);
  new Uint8Array(buf).set(bytes, 0);
  return buf;
}

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
    if (status >= 200 && status < 300) this.onload?.();
    else this.onload?.();
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

describe("MediaLibrary", () => {
  it("refuses a 21 MB PNG before any request", async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/media/upload-url`,
        async ({ request }) => {
          requests.push(request.url);
          return HttpResponse.json(f.uploadTicket, { status: 201 });
        }
      )
    );
    render(<Harness />);
    const input = await screen.findByTestId<HTMLInputElement>(
      "media-file-input"
    );
    const bytes = fillTo(PNG_MAGIC, 21 * 1024 * 1024);
    const file = new File([bytes], "huge.png", { type: "image/png" });
    await user.upload(input, file);
    // The size issue is surfaced on the row; no upload-url call happens.
    await waitFor(() =>
      expect(screen.getByText("File is larger than 20 MB")).toBeInTheDocument()
    );
    expect(requests.length).toBe(0);
    expect(xhrCreated.length).toBe(0);
  });

  it("refuses a 2 MB SVG before any request", async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/media/upload-url`,
        async ({ request }) => {
          requests.push(request.url);
          return HttpResponse.json(f.uploadTicket, { status: 201 });
        }
      )
    );
    render(<Harness />);
    const input = await screen.findByTestId<HTMLInputElement>(
      "media-file-input"
    );
    const bytes = fillTo(SVG_TEXT, 2 * 1024 * 1024);
    const file = new File([bytes], "huge.svg", { type: "image/svg+xml" });
    await user.upload(input, file);
    await waitFor(() =>
      expect(screen.getByText("SVG is larger than 1 MB")).toBeInTheDocument()
    );
    expect(requests.length).toBe(0);
    expect(xhrCreated.length).toBe(0);
  });

  it("runs the ticket, PUT, confirm sequence for a valid PNG", async () => {
    const user = userEvent.setup();
    let ticketRequests = 0;
    let confirmRequests = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/media/upload-url`,
        () => {
          ticketRequests += 1;
          return HttpResponse.json(
            {
              ...f.uploadTicket,
              uploadUrl: "https://s3.example/put",
              media: { ...f.mediaAssets[0], id: "new-asset-id" },
            },
            { status: 201 }
          );
        }
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/media/new-asset-id/confirm`,
        () => {
          confirmRequests += 1;
          return HttpResponse.json({
            ...f.mediaAssets[0],
            id: "new-asset-id",
            state: "ready",
          });
        }
      )
    );
    render(<Harness />);
    const input = await screen.findByTestId<HTMLInputElement>(
      "media-file-input"
    );
    const file = new File([bytesToBuffer(PNG_MAGIC)], "hero.png", { type: "image/png" });
    await user.upload(input, file);

    await waitFor(() => expect(ticketRequests).toBeGreaterThan(0));
    await waitFor(() => expect(xhrCreated.length).toBeGreaterThan(0));
    await act(async () => xhrCreated[0]!.respond(200));
    await waitFor(() => expect(confirmRequests).toBeGreaterThan(0));
    await waitFor(() =>
      expect(screen.getAllByText("Ready").length).toBeGreaterThan(0)
    );
  });

  it("offers Retry when the S3 PUT fails and retries the whole sequence", async () => {
    const user = userEvent.setup();
    let ticketRequests = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/media/upload-url`,
        () => {
          ticketRequests += 1;
          return HttpResponse.json(
            {
              ...f.uploadTicket,
              uploadUrl: "https://s3.example/put",
              media: { ...f.mediaAssets[0], id: "asset-2" },
            },
            { status: 201 }
          );
        }
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/media/asset-2/confirm`,
        () => HttpResponse.json({ ...f.mediaAssets[0], id: "asset-2" })
      )
    );
    render(<Harness />);
    const input = await screen.findByTestId<HTMLInputElement>(
      "media-file-input"
    );
    const file = new File([bytesToBuffer(PNG_MAGIC)], "hero.png", { type: "image/png" });
    await user.upload(input, file);
    await waitFor(() => expect(xhrCreated.length).toBeGreaterThan(0));
    // Fail the PUT with a 500.
    await act(async () => xhrCreated[0]!.respond(500));
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(ticketRequests).toBe(1);
    await user.click(retry);
    await waitFor(() => expect(xhrCreated.length).toBeGreaterThan(1));
    await act(async () => xhrCreated[1]!.respond(200));
    await waitFor(() =>
      expect(screen.getAllByText("Ready").length).toBeGreaterThan(0)
    );
  });

  it("renders 409 media_in_use with the usage list in the detail drawer", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(
        `${testConfig.apiBaseUrl}/admin/media/${f.mediaAssets[0]!.id}`,
        () =>
          HttpResponse.json(
            {
              code: "media_in_use",
              message: "This asset is in use",
              details: { usage: f.mediaUsage },
              requestId: "req-abc",
            },
            { status: 409 }
          )
      )
    );
    render(<Harness />);
    // Open the drawer via the first card.
    const card = await screen.findByTestId(
      `media-card-${f.mediaAssets[0]!.id}`
    );
    await user.click(within(card).getByRole("button"));
    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    await user.click(deleteButton);
    const confirmButtons = await screen.findAllByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    // The 409 renders "In use by:" and the usage list.
    expect(await screen.findByText(/in use by/i)).toBeInTheDocument();
  });
});
