import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import SiteSettings from "./SiteSettings";
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
          <MemoryRouter initialEntries={["/site-settings"]}>
            <NotifyProvider>
              <SiteSettings />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const FULL_DRAFT = {
  siteName: "Western Montana Santa Flyover",
  tagline: null,
  homeNavLabel: "Home",
  logo: null,
  favicon: null,
  theme: {
    accent: "red",
    surface: "night",
    fontPairing: "classic",
    snowDefault: false,
  },
  navExtraLinks: [],
  footerLinks: [],
  footerText: null,
  contactEmail: null,
  donateUrl: null,
  analyticsEnabled: false,
};

beforeEach(() => {
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
      HttpResponse.json({
        ...f.siteSettingsDraft,
        data: FULL_DRAFT,
      })
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("SiteSettings", () => {
  it("renders the form from the vendored schema (theme swatches present)", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    // Accent swatches for the enum values.
    expect(screen.getByTestId("theme-accent-red")).toBeInTheDocument();
    expect(screen.getByTestId("theme-accent-green")).toBeInTheDocument();
    expect(screen.getByTestId("theme-accent-gold")).toBeInTheDocument();
    expect(screen.getByTestId("theme-accent-blue")).toBeInTheDocument();
    // Surface swatches.
    expect(screen.getByTestId("theme-surface-night")).toBeInTheDocument();
    expect(screen.getByTestId("theme-surface-snow")).toBeInTheDocument();
    expect(screen.getByTestId("theme-surface-forest")).toBeInTheDocument();
    // Snow default switch.
    expect(screen.getByTestId("theme-snow-default")).toBeInTheDocument();
  });

  it("save sends the whole document with PUT", async () => {
    const user = userEvent.setup();
    const captured: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/site-settings`,
        async ({ request }) => {
          const body = await request.json();
          captured.push({ url: request.url, body });
          return HttpResponse.json({
            ...f.siteSettingsDraft,
            data: FULL_DRAFT,
          });
        }
      )
    );
    render(<Harness />);
    // Wait for the theme field so the initial data is loaded.
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    // Change the theme accent, which triggers a form onChange and dirties.
    await user.click(screen.getByTestId("theme-accent-blue"));
    const save = await screen.findByTestId("site-settings-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.click(save);
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]?.body as { data?: Record<string, unknown> };
    expect(body?.data).toBeDefined();
    // The saved document carries every top-level property from the draft.
    for (const key of Object.keys(FULL_DRAFT)) {
      expect(body?.data).toHaveProperty(key);
    }
    // The accent change is reflected.
    const theme = body?.data?.theme as { accent?: string } | undefined;
    expect(theme?.accent).toBe("blue");
  });

  it("renders problems from the draft response", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: FULL_DRAFT,
          problems: [
            { path: "siteName", message: "must be at least 1 character" },
          ],
        })
      )
    );
    render(<Harness />);
    expect(await screen.findByTestId("site-settings-problems")).toBeInTheDocument();
    expect(
      screen.getByText(/must be at least 1 character/i)
    ).toBeInTheDocument();
  });

  it("opens the preview dialog and mints a token", async () => {
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
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    await user.click(screen.getByTestId("site-settings-preview"));
    await waitFor(() => expect(tokens).toBeGreaterThan(0));
    expect(await screen.findByTestId("preview-iframe")).toBeInTheDocument();
  });
});
