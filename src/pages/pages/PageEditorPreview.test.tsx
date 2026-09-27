// admin.md 6.14, the preview beside the page editor:
//   - at 1280 px and up the Preview button opens the pane as a column
//     beside the editor, showing the edited page's slug
//   - below 1280 px it opens the full-screen dialog instead
//   - the pane requests a preview token once
//   - finished saves trigger one reload after the 1.5 s debounce
//   - the open state is remembered in localStorage

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PageEditor from "./PageEditor";
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
          <MemoryRouter initialEntries={["/pages/3"]}>
            <NotifyProvider>
              <Routes>
                <Route path="/pages/:id" element={<PageEditor />} />
              </Routes>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

// Answers media queries as a viewport of the given width would.
function stubViewport(width: number): () => void {
  const original = window.matchMedia;
  const evaluate = (query: string): boolean => {
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    if (min && width < Number(min[1])) return false;
    if (max && width > Number(max[1])) return false;
    return Boolean(min || max);
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: evaluate(query),
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

let tokens = 0;
let restoreViewport: (() => void) | null = null;

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
  tokens = 0;
  server.use(
    http.post(`${testConfig.apiBaseUrl}/admin/content/preview-token`, () => {
      tokens += 1;
      return HttpResponse.json(
        {
          ...f.previewToken,
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        },
        { status: 201 }
      );
    })
  );
});

afterEach(() => {
  restoreViewport?.();
  restoreViewport = null;
  vi.useRealTimers();
  server.resetHandlers();
  localStorage.clear();
});

const slug = f.pageDetail.slug ?? "";

describe("PageEditor preview", () => {
  it("opens the pane beside the editor at 1280 px, showing the edited page, with one token", async () => {
    restoreViewport = stubViewport(1280);
    render(<Harness />);
    fireEvent.click(await screen.findByTestId("page-preview-toggle"));
    const column = await screen.findByTestId("page-preview-column");
    const iframe = await within(column).findByTestId("preview-iframe");
    expect(iframe.getAttribute("src") ?? "").toMatch(
      new RegExp(`[?&]page=${slug}(?:$|&)`)
    );
    // Beside the editor, not in a dialog.
    expect(screen.queryByRole("dialog")).toBeNull();
    // The editor is still on screen.
    expect(screen.getByTestId("section-stack")).toBeInTheDocument();
    await waitFor(() => expect(tokens).toBe(1));
    // The open state is remembered.
    expect(localStorage.getItem("pageEditorPreviewOpen")).toBe("1");
    fireEvent.click(screen.getByTestId("page-preview-close"));
    expect(screen.queryByTestId("page-preview-column")).toBeNull();
    expect(localStorage.getItem("pageEditorPreviewOpen")).toBeNull();
  });

  it("reopens the column on the next visit when it was left open", async () => {
    restoreViewport = stubViewport(1440);
    localStorage.setItem("pageEditorPreviewOpen", "1");
    render(<Harness />);
    expect(await screen.findByTestId("page-preview-column")).toBeInTheDocument();
  });

  it("opens the dialog below 1280 px", async () => {
    restoreViewport = stubViewport(390);
    render(<Harness />);
    fireEvent.click(await screen.findByTestId("page-preview-toggle"));
    const dialog = await screen.findByRole("dialog");
    const iframe = await within(dialog).findByTestId("preview-iframe");
    expect(iframe.getAttribute("src") ?? "").toMatch(
      new RegExp(`[?&]page=${slug}(?:$|&)`)
    );
    expect(screen.queryByTestId("page-preview-column")).toBeNull();
    expect(tokens).toBe(1);
  });

  it("reloads the pane once, 1.5 s after saves finish", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    restoreViewport = stubViewport(1280);
    let patches = 0;
    server.use(
      http.patch("*/admin/sections/:id", () => {
        patches += 1;
        return HttpResponse.json(f.sampleSection);
      })
    );
    render(<Harness />);
    fireEvent.click(await screen.findByTestId("page-preview-toggle"));
    const column = await screen.findByTestId("page-preview-column");
    const srcNow = () =>
      within(column).getByTestId("preview-iframe").getAttribute("src") ?? "";
    await within(column).findByTestId("preview-iframe");
    const before = srcNow();
    expect(before).not.toMatch(/[?&]r=/);

    // Two saves in a row: the Hidden switch patches at once.
    const card = await screen.findByTestId(`section-card-${f.sampleSection.id}`);
    const hidden = within(card).getByRole("switch");
    fireEvent.click(hidden);
    await waitFor(() => expect(patches).toBe(1));
    fireEvent.click(hidden);
    await waitFor(() => expect(patches).toBe(2));

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(srcNow()).toBe(before);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await waitFor(() => expect(srcNow()).toMatch(/[?&]r=1(?:$|&)/));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(srcNow()).toMatch(/[?&]r=1(?:$|&)/);
    // Reloading reuses the valid token.
    expect(tokens).toBe(1);
  });
});
