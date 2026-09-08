import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PreviewFrame from "./PreviewFrame";
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

function Harness({
  slug = "about",
}: {
  slug?: string | null;
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
          <MemoryRouter initialEntries={["/pages/3"]}>
            <NotifyProvider>
              <PreviewFrame
                open={true}
                onClose={() => undefined}
                initialSlug={slug}
              />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
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
});

afterEach(() => {
  server.resetHandlers();
});

describe("PreviewFrame", () => {
  it("mints a token when opened and sets the iframe src with the page slug", async () => {
    let tokens = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/preview-token`,
        () => {
          tokens += 1;
          return HttpResponse.json(f.previewToken, { status: 201 });
        }
      )
    );
    render(<Harness slug="about" />);
    await waitFor(() => expect(tokens).toBe(1));
    const iframe = await screen.findByTestId<HTMLIFrameElement>("preview-iframe");
    // The src carries the mint URL plus &page=about.
    const src = iframe.getAttribute("src") ?? "";
    expect(src).toContain(f.previewToken.token);
    expect(src).toMatch(/[?&]page=about(?:$|&)/);
  });

  it("Reload does not mint a new token while the current one is valid", async () => {
    const user = userEvent.setup();
    let tokens = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/preview-token`,
        () => {
          tokens += 1;
          return HttpResponse.json(
            {
              ...f.previewToken,
              expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            },
            { status: 201 }
          );
        }
      )
    );
    render(<Harness slug="about" />);
    await waitFor(() => expect(tokens).toBe(1));
    await user.click(await screen.findByTestId("preview-reload"));
    // No new mint; only the reload nonce changes.
    expect(tokens).toBe(1);
  });

  it("mints a new token when Reload is pressed after expiry", async () => {
    const user = userEvent.setup();
    let tokens = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/preview-token`,
        () => {
          tokens += 1;
          // Already expired.
          return HttpResponse.json(
            {
              ...f.previewToken,
              expiresAt: new Date(Date.now() - 60_000).toISOString(),
            },
            { status: 201 }
          );
        }
      )
    );
    render(<Harness slug="about" />);
    await waitFor(() => expect(tokens).toBe(1));
    // Countdown reports expired.
    expect(await screen.findByText(/token expired/i)).toBeInTheDocument();
    await user.click(await screen.findByTestId("preview-reload"));
    await waitFor(() => expect(tokens).toBe(2));
  });

  it("New token button always mints a fresh token", async () => {
    const user = userEvent.setup();
    let tokens = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/preview-token`,
        () => {
          tokens += 1;
          return HttpResponse.json(f.previewToken, { status: 201 });
        }
      )
    );
    render(<Harness slug="about" />);
    await waitFor(() => expect(tokens).toBe(1));
    await user.click(await screen.findByTestId("preview-new-token"));
    await waitFor(() => expect(tokens).toBe(2));
  });

  it("switching pages updates the iframe src without a new token", async () => {
    const user = userEvent.setup();
    let tokens = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/preview-token`,
        () => {
          tokens += 1;
          return HttpResponse.json(f.previewToken, { status: 201 });
        }
      )
    );
    render(<Harness slug="about" />);
    await waitFor(() => expect(tokens).toBe(1));
    const iframe0 = (await screen.findByTestId<HTMLIFrameElement>(
      "preview-iframe"
    )).getAttribute("src");
    expect(iframe0).toMatch(/[?&]page=about(?:$|&)/);
    // The fixture's PageAdmin[1] slug is "about"; select "Home" (empty).
    const select = await screen.findByTestId("preview-page-select");
    // MUI select is a hidden native element inside; use userEvent on the combobox.
    const combobox = within(select).getByRole("combobox");
    await user.click(combobox);
    const homeOption = await screen.findByRole("option", { name: /home/i });
    await user.click(homeOption);
    await waitFor(() => {
      const iframe1 = (screen.getByTestId(
        "preview-iframe"
      ) as HTMLIFrameElement).getAttribute("src");
      expect(iframe1).not.toMatch(/[?&]page=about(?:$|&)/);
    });
    // Still only one mint call.
    expect(tokens).toBe(1);
  });

  it("countdown ticks toward zero", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/preview-token`,
        () =>
          HttpResponse.json(
            {
              ...f.previewToken,
              expiresAt: new Date(Date.now() + 2 * 60_000).toISOString(),
            },
            { status: 201 }
          )
      )
    );
    render(<Harness slug={null} />);
    await waitFor(() => {
      expect(screen.getByTestId("preview-countdown")).toBeInTheDocument();
    });
    // Countdown should say "2 min" initially.
    expect(screen.getByTestId("preview-countdown").textContent).toMatch(/2 min/);
    await act(async () => {
      vi.advanceTimersByTime(90_000);
    });
    await waitFor(() => {
      expect(screen.getByTestId("preview-countdown").textContent).toMatch(
        /1 min/
      );
    });
    vi.useRealTimers();
  });
});
