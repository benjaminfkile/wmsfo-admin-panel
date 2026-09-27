// admin.md 6.17, the Share menu of the preview toolbar:
//   - the Link lasts select defaults to 8 hours and is remembered
//   - Open mints with the chosen lifetime and opens the site URL with the
//     pane's page and theme, with noopener
//   - Copy mints the same way, writes the clipboard, and the snackbar
//     shows the expiry
//   - without a clipboard the URL shows in a read-only field
//   - the pane's own mint sends no body
//   - the page select reads "Start at" with the click-around hint; without
//     the select neither shows and the frame stays on the given page

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PreviewPane from "./PreviewPane";
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

function Harness({ showPageSelector = true }: { showPageSelector?: boolean }) {
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
          <MemoryRouter initialEntries={["/pages/3"]}>
            <NotifyProvider>
              <div style={{ height: 600 }}>
                <PreviewPane
                  active={true}
                  initialSlug="about"
                  showPageSelector={showPageSelector}
                />
              </div>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

// Request bodies of every mint, in order; "" when the request had none.
let bodies: string[] = [];
const expiresAt = new Date(Date.now() + 8 * 3_600_000).toISOString();
const originalClipboard = Object.getOwnPropertyDescriptor(
  window.navigator,
  "clipboard"
);

function setClipboard(value: unknown) {
  Object.defineProperty(window.navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  localStorage.clear();
  bodies = [];
  server.use(
    http.post(
      `${testConfig.apiBaseUrl}/admin/content/preview-token`,
      async ({ request }) => {
        bodies.push(await request.text());
        return HttpResponse.json(
          { ...f.previewToken, expiresAt },
          { status: 201 }
        );
      }
    )
  );
});

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  vi.restoreAllMocks();
  if (originalClipboard) {
    Object.defineProperty(window.navigator, "clipboard", originalClipboard);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window.navigator as any).clipboard;
  }
});

async function openShare(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByTestId("preview-iframe");
  await user.click(screen.getByTestId("preview-share"));
  return screen.findByTestId("preview-share-menu");
}

describe("PreviewPane Share", () => {
  it("the pane's own mint sends no body", async () => {
    render(<Harness />);
    await screen.findByTestId("preview-iframe");
    expect(bodies).toEqual([""]);
  });

  it("Link lasts defaults to 8 hours and is remembered", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    let menu = await openShare(user);
    const ttl = within(menu).getByTestId("preview-share-ttl");
    expect(within(ttl).getByRole("combobox")).toHaveTextContent("8 hours");
    await user.click(within(ttl).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "1 hour" }));
    expect(localStorage.getItem("previewShareTtlMinutes")).toBe("60");
    unmount();

    render(<Harness />);
    menu = await openShare(user);
    expect(
      within(within(menu).getByTestId("preview-share-ttl")).getByRole("combobox")
    ).toHaveTextContent("1 hour");
  });

  it("Open mints with ttlMinutes 480 and opens the site URL with page and theme", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<Harness />);
    await screen.findByTestId("preview-iframe");
    await user.click(screen.getByRole("button", { name: "Dark" }));
    const menu = await openShare(user);
    await user.click(within(menu).getByTestId("preview-share-open"));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(JSON.parse(bodies[1] ?? "")).toEqual({ ttlMinutes: 480 });
    const [url, target, features] = open.mock.calls[0] ?? [];
    expect(String(url)).toContain(f.previewToken.token);
    expect(String(url)).toMatch(/[?&]page=about(?:$|&)/);
    expect(String(url)).toMatch(/[?&]theme=dark(?:$|&)/);
    expect(String(url)).not.toMatch(/[?&]r=/);
    expect(target).toBe("_blank");
    expect(features).toBe("noopener");
  });

  it("Copy mints, writes the clipboard, and the snackbar shows the expiry", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<Harness />);
    const menu = await openShare(user);
    await user.click(within(menu).getByTestId("preview-share-copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(JSON.parse(bodies[1] ?? "")).toEqual({ ttlMinutes: 480 });
    const url = String(writeText.mock.calls[0]?.[0]);
    expect(url).toContain(f.previewToken.token);
    expect(url).toMatch(/[?&]page=about(?:$|&)/);
    const time = new Date(expiresAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const alert = await screen.findByText(/^Link copied, valid until /);
    expect(alert.textContent).toContain(time);
    expect(screen.queryByTestId("preview-share-fallback")).toBeNull();
  });

  it("without a clipboard the link shows in a read-only field with Select", async () => {
    const user = userEvent.setup();
    setClipboard(undefined);
    render(<Harness />);
    const menu = await openShare(user);
    await user.click(within(menu).getByTestId("preview-share-copy"));
    const field = await within(menu).findByTestId<HTMLInputElement>(
      "preview-share-url"
    );
    expect(field.readOnly).toBe(true);
    expect(field.value).toContain(f.previewToken.token);
    expect(field.value).toMatch(/[?&]page=about(?:$|&)/);
    await user.click(within(menu).getByTestId("preview-share-select"));
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
    expect(screen.queryByText(/^Link copied/)).toBeNull();
  });

  it("shows the live hint", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const menu = await openShare(user);
    expect(
      within(menu).getByText("The link follows your draft live while it is open.")
    ).toBeInTheDocument();
  });
});

describe("PreviewPane Start at", () => {
  it("labels the page select Start at and shows the hint", async () => {
    render(<Harness />);
    await screen.findByTestId("preview-iframe");
    const select = screen.getByTestId("preview-page-select");
    expect(within(select).getByText("Start at", { selector: "label" })).toBeInTheDocument();
    expect(within(select).getByRole("combobox")).toHaveTextContent("about");
    expect(
      screen.getByText("Click around: every page shows your draft.")
    ).toBeInTheDocument();
  });

  it("without the select the frame starts at the given page and shows no hint", async () => {
    render(<Harness showPageSelector={false} />);
    const iframe = await screen.findByTestId("preview-iframe");
    expect(iframe.getAttribute("src")).toMatch(/[?&]page=about(?:$|&)/);
    expect(screen.queryByTestId("preview-page-select")).toBeNull();
    expect(screen.queryByTestId("preview-site-hint")).toBeNull();
  });
});
