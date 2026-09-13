import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import EventDetail from "./EventDetail";
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
          <MemoryRouter initialEntries={[`/events/${id}`]}>
            <NotifyProvider>
              <Routes>
                <Route path="/events/:id" element={<EventDetail />} />
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

describe("EventDetail: route poster and flight history blocks", () => {
  it("Remove poster sends PATCH { routeImageMediaId: '' }", async () => {
    const user = userEvent.setup();
    const captured: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          routeImageMediaId: f.mediaAssets[0]!.id,
          routeImage: f.mediaAssets[0]!,
        })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          const body = await request.json();
          captured.push({ url: request.url, body });
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    // Wait for the poster section to render.
    await screen.findByRole("heading", { name: /route poster/i });
    await user.click(
      await screen.findByTestId("route-poster-remove")
    );
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]?.body).toEqual({ routeImageMediaId: "" });
  });

  it("Record from this event calls the /routes/from-event endpoint then PATCH routeId", async () => {
    const user = userEvent.setup();
    const posts: string[] = [];
    const patches: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          routeId: null,
        })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/routes/from-event/:eventId`,
        ({ request }) => {
          posts.push(request.url);
          return HttpResponse.json({ ...f.routes[0]!, id: 42 }, { status: 201 });
        }
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          patches.push({ body: await request.json() });
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /flight history/i });
    await user.click(screen.getByTestId("flight-history-record"));
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    expect(posts[0]).toMatch(/\/admin\/routes\/from-event\//);
    await waitFor(() => expect(patches.length).toBeGreaterThan(0));
    expect(patches[0]?.body).toEqual({ routeId: 42 });
  });

  it("Unlink sends PATCH { routeId: null }", async () => {
    const user = userEvent.setup();
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          routeId: 4,
        })
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/events/:id`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json(f.events[0]);
        }
      )
    );
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /flight history/i });
    await user.click(await screen.findByTestId("flight-history-unlink"));
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]?.body).toEqual({ routeId: null });
  });

  it("reopens the picker on 409 media_not_ready from the route poster PATCH", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
        HttpResponse.json({
          ...f.events[0]!,
          routeImageMediaId: f.mediaAssets[0]!.id,
          routeImage: f.mediaAssets[0]!,
        })
      ),
      http.patch(`${testConfig.apiBaseUrl}/admin/events/:id`, () =>
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
    render(<Harness id={Number(f.events[0]!.id)} />);
    await screen.findByRole("heading", { name: /route poster/i });
    await user.click(await screen.findByTestId("route-poster-choose"));
    // Wait for the picker to open, click the asset, then confirm.
    const card = await screen.findByTestId(
      `media-card-${f.mediaAssets[0]!.id}`
    );
    await user.click(within(card).getAllByRole("button")[0]!);
    await user.click(screen.getByRole("button", { name: /^choose$/i }));
    // After the 409, the picker re-opens.
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: /choose route poster/i })
      ).toBeInTheDocument()
    );
  });
});
