import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import SponsorDetail from "./SponsorDetail";
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

function Harness({ id }: { id: number }) {
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
          <MemoryRouter initialEntries={[`/sponsors/${id}`]}>
            <NotifyProvider>
              <Routes>
                <Route path="/sponsors/:id" element={<SponsorDetail />} />
              </Routes>
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

describe("SponsorDetail: year upsert", () => {
  it("PUTs the six fields to /admin/sponsors/{id}/years/{eventYear}", async () => {
    const user = userEvent.setup();
    const captured: Array<{
      url: string;
      body: Record<string, unknown>;
    }> = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/sponsors/:id/years/:eventYear`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push({ url: request.url, body });
          return HttpResponse.json(f.sponsors[0]);
        }
      )
    );
    render(<Harness id={Number(f.sponsors[0]!.id)} />);
    // Wait for the details form to render.
    await screen.findByText(f.sponsors[0]!.name!);
    await user.click(screen.getByRole("button", { name: /add year/i }));
    // Fill year and amount.
    const yearInput = await screen.findByLabelText(/event year/i);
    await user.clear(yearInput);
    await user.type(yearInput, "2027");
    const amount = screen.getByLabelText(/amount donated/i);
    await user.type(amount, "250");
    // Save.
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const c = captured[0]!;
    expect(c.url).toContain(`/years/2027`);
    // The body carries the six documented fields with the switch defaults.
    expect(c.body).toEqual({
      amountDonated: 250,
      active: true,
      canAdvertise: true,
      anonymous: false,
      pinnedPosition: null,
      lingerMsOverride: null,
    });
  });

  it("rejects a lingerMsOverride outside 0..600 seconds without calling the API", async () => {
    const user = userEvent.setup();
    const captured: Array<Record<string, unknown>> = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/sponsors/:id/years/:eventYear`,
        async ({ request }) => {
          captured.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json(f.sponsors[0]);
        }
      )
    );
    render(<Harness id={Number(f.sponsors[0]!.id)} />);
    await screen.findByText(f.sponsors[0]!.name!);
    await user.click(screen.getByRole("button", { name: /add year/i }));
    const yearInput = await screen.findByLabelText(/event year/i);
    await user.clear(yearInput);
    await user.type(yearInput, "2027");
    const override = screen.getByLabelText(/tracker time override/i);
    await user.clear(override);
    await user.type(override, "601");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(
      await screen.findByText(/whole number of seconds between 0 and 600/i)
    ).toBeInTheDocument();
    expect(captured).toEqual([]);
  });
});

describe("SponsorDetail: logo", () => {
  it("choosing a logo sends PATCH { logoMediaId }", async () => {
    const user = userEvent.setup();
    const captured: Array<Record<string, unknown>> = [];
    server.use(
      http.patch(
        `${testConfig.apiBaseUrl}/admin/sponsors/:id`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.push(body);
          return HttpResponse.json(f.sponsors[0]);
        }
      )
    );
    render(<Harness id={Number(f.sponsors[0]!.id)} />);
    await screen.findByText(f.sponsors[0]!.name!);
    // Open the logo picker.
    await user.click(screen.getByRole("button", { name: /choose logo/i }));
    // Wait for the picker's grid to load and click the asset card.
    const card = await screen.findByTestId(
      `media-card-${f.mediaAssets[0]!.id}`
    );
    await user.click(within(card).getAllByRole("button")[0]!);
    // Confirm with the dialog's Choose button.
    await user.click(screen.getByRole("button", { name: /^choose$/i }));
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]).toEqual({ logoMediaId: f.mediaAssets[0]!.id });
  });

  it("reopens the picker on 409 media_not_ready", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(
        `${testConfig.apiBaseUrl}/admin/sponsors/:id`,
        () =>
          HttpResponse.json(
            {
              code: "media_not_ready",
              message: "media not ready",
              details: null,
              requestId: "req-x",
            },
            { status: 409 }
          )
      )
    );
    render(<Harness id={Number(f.sponsors[0]!.id)} />);
    await screen.findByText(f.sponsors[0]!.name!);
    await user.click(screen.getByRole("button", { name: /choose logo/i }));
    const card = await screen.findByTestId(
      `media-card-${f.mediaAssets[0]!.id}`
    );
    await user.click(within(card).getAllByRole("button")[0]!);
    await user.click(screen.getByRole("button", { name: /^choose$/i }));
    // After the 409, the picker reopens: the Choose Media dialog stays open.
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: /choose sponsor logo/i })
      ).toBeInTheDocument()
    );
  });
});
