import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import Dashboard from "./Dashboard";
import { ConfigProvider } from "../ConfigContext";
import { NotifyProvider } from "../hooks/useNotify";
import { installClient } from "../api/client";
import { installCdn } from "../api/cdn";
import { buildTheme } from "../theme/theme";
import { server } from "../test/msw/server";
import * as f from "../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../test/renderWithProviders";

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
          <MemoryRouter initialEntries={["/"]}>
            <NotifyProvider>
              <Dashboard />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

// jsdom does not implement `window.matchMedia`; MUI's `useMediaQuery`
// (and so `useCompact`) reads it. Stubbing lets the compact spec render
// the phone layout with the collapsed JSON blocks.
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
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  installCdn({ cdnBaseUrl: testConfig.cdnBaseUrl });
});

afterEach(() => {
  server.resetHandlers();
});

describe("Dashboard", () => {
  it("renders the five cards from the fixtures", async () => {
    render(<Harness />);
    // Current event card
    expect(await screen.findByText("Current event")).toBeInTheDocument();
    // Wait for events fetch
    await screen.findByText(f.events[0]!.name!);
    // Active beacon card
    expect(screen.getByText("Active beacon")).toBeInTheDocument();
    await screen.findByText(f.beacons[0]!.name!);
    // Published state card
    expect(screen.getByText("Published state")).toBeInTheDocument();
    // Snapshot card
    expect(screen.getByText("Snapshot")).toBeInTheDocument();
    // Live object card
    expect(screen.getByText("Live object (CDN)")).toBeInTheDocument();
  });

  it("reports write_error in red", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/live`, () =>
        HttpResponse.json({
          ...f.liveState,
          lastWriteError: "s3 write timed out",
        })
      )
    );
    render(<Harness />);
    expect(
      await screen.findByText(/write error: s3 write timed out/i)
    ).toBeInTheDocument();
  });

  it("clicking Republish triggers the mutation", async () => {
    const republishSpy = vi.fn(() => HttpResponse.json(f.liveObject));
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/live/republish`, republishSpy)
    );
    const user = userEvent.setup();
    render(<Harness />);
    const btn = await screen.findByRole("button", { name: /republish/i });
    await user.click(btn);
    // Confirmation dialog.
    const confirmBtn = await screen.findByRole("button", {
      name: /^republish$/i,
    });
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(republishSpy).toHaveBeenCalled();
    });
  });

  it("shows an active beacon warning when no beacon is active but an event is live", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/beacons`, () =>
        HttpResponse.json({ items: [], staleAfterS: 45 })
      )
    );
    render(<Harness />);
    // "No active beacon" appears once and (via the event fixture) in red.
    const el = await screen.findByText(/no active beacon/i);
    expect(el).toBeInTheDocument();
  });

  it("renders the current event fields", async () => {
    render(<Harness />);
    const nameEl = await screen.findByText(/santa flyover 2026/i);
    const currentCard = nameEl.closest(".MuiCard-root") as HTMLElement;
    expect(within(currentCard).getByText(/63%/)).toBeInTheDocument();
  });

  it("on compact renders the five cards with the JSON blocks collapsed to one level", async () => {
    // Desktop render: full JSON tree.
    const restoreDesktop = stubMatchMedia(false);
    const desktop = render(<Harness />);
    await screen.findByText(f.events[0]!.name!);
    await screen.findByText("Live object (CDN)");
    await waitFor(() => {
      expect(
        desktop.container.querySelectorAll(".w-rjv-line").length
      ).toBeGreaterThan(0);
    });
    const desktopLines = desktop.container.querySelectorAll(".w-rjv-line")
      .length;
    desktop.unmount();
    restoreDesktop();

    // Compact render: the JSON views start collapsed at one level, so the
    // rendered `.w-rjv-line` count drops below the desktop tree.
    const restoreCompact = stubMatchMedia(true);
    try {
      const { container } = render(<Harness />);
      expect(await screen.findByText("Current event")).toBeInTheDocument();
      expect(screen.getByText("Active beacon")).toBeInTheDocument();
      expect(screen.getByText("Published state")).toBeInTheDocument();
      expect(screen.getByText("Snapshot")).toBeInTheDocument();
      await screen.findByText("Live object (CDN)");
      await waitFor(() => {
        expect(
          container.querySelectorAll(".w-rjv-line").length
        ).toBeGreaterThan(0);
      });
      const compactLines = container.querySelectorAll(".w-rjv-line").length;
      expect(compactLines).toBeLessThan(desktopLines);
      // Settle any pending state updates before the media query restore
      // to keep React from logging an act warning.
      await act(async () => undefined);
    } finally {
      restoreCompact();
    }
  });
});
