import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RoutesList from "./RoutesList";
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
          <MemoryRouter initialEntries={["/routes"]}>
            <NotifyProvider>
              <RoutesList />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

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
});

afterEach(() => {
  server.resetHandlers();
});

describe("RoutesList", () => {
  it("renders a card per recording on compact with the row menu", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(<Harness />);
      const card = await screen.findByTestId(`route-row-${f.routes[0]!.id}`);
      expect(within(card).getByText(f.routes[0]!.name!)).toBeInTheDocument();
      expect(
        within(card).getByRole("button", {
          name: new RegExp(`actions for ${f.routes[0]!.name}`, "i"),
        })
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
    } finally {
      restore();
    }
  });
});

describe("RoutesList: the site route chips and the delete refusal", () => {
  const API = testConfig.apiBaseUrl;
  const BASE = f.routes[0]!;
  const ITEMS = [
    { ...BASE, id: 4, name: "Published one", isSiteRoute: true, isDraftRoute: false, createdAt: "2026-11-03T00:00:00.000Z" },
    { ...BASE, id: 5, name: "Draft one", isSiteRoute: false, isDraftRoute: true, createdAt: "2026-11-02T00:00:00.000Z" },
    { ...BASE, id: 6, name: "Unused one", isSiteRoute: false, isDraftRoute: false, createdAt: "2026-11-01T00:00:00.000Z" },
  ];

  beforeEach(() => {
    server.use(http.get(`${API}/admin/routes`, () => HttpResponse.json({ items: ITEMS })));
  });

  it("shows Site route on the published one, Draft on the draft one, and no Used by column", async () => {
    render(<Harness />);
    const published = await screen.findByTestId("route-row-4");
    expect(within(published).getByTestId("route-site-4")).toHaveTextContent("Site route");
    expect(within(published).queryByTestId("route-draft-4")).toBeNull();
    const draft = screen.getByTestId("route-row-5");
    expect(within(draft).getByTestId("route-draft-5")).toHaveTextContent("Draft");
    expect(within(draft).queryByTestId("route-site-5")).toBeNull();
    const unused = screen.getByTestId("route-row-6");
    expect(within(unused).queryByText("Site route")).toBeNull();
    expect(within(unused).queryByText("Draft")).toBeNull();
    expect(screen.queryByText("Used by")).toBeNull();
  });

  it("shows both chips when the draft and the published settings name the same route", async () => {
    server.use(
      http.get(`${API}/admin/routes`, () =>
        HttpResponse.json({ items: [{ ...BASE, isSiteRoute: true, isDraftRoute: true }] })
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId(`route-row-${BASE.id}`);
    expect(within(row).getByText("Site route")).toBeInTheDocument();
    expect(within(row).getByText("Draft")).toBeInTheDocument();
  });

  it("Delete shows the API's refusal text while the route is in use", async () => {
    const refusal =
      "The site settings name this route. Choose another route or none in Site settings first.";
    server.use(
      http.get(`${API}/admin/routes/:id/impact`, () =>
        HttpResponse.json({ blocked: null, deletes: [{ entity: "route", count: 1, names: ["Published one"] }], unlinks: [], warnings: [] })
      ),
      http.delete(`${API}/admin/routes/:id`, () =>
        HttpResponse.json(
          { code: "route_in_use", message: refusal, details: { where: ["draft", "published"] }, requestId: "r1" },
          { status: 409 }
        )
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId("route-row-4");
    fireEvent.click(within(row).getByRole("button", { name: /actions for published one/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = await within(dialog).findByRole("button", { name: /^delete$/i });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    expect(await within(dialog).findByText(refusal)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("RoutesList help buttons (admin.md 6.26)", () => {
  it("mounts the header help and every card help of the default render", async () => {
    render(<Harness />);
    for (const key of [
      "routes",
    ]) {
      expect(await screen.findByTestId(`help-${key}`)).toBeInTheDocument();
    }
  });
});
