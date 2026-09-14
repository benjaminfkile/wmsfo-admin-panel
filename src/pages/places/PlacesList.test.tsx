// admin.md 6.24 and 9.2: the places tree's indentation, location cell
// states, and the New place dialog wire through the API. Component
// tests only.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PlacesList from "./PlacesList";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { NotifyProvider } from "../../hooks/useNotify";
import AuthProvider from "../../auth/AuthProvider";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import type { UserManager } from "oidc-client-ts";

let userManager: UserManager;

// jsdom does not implement `window.matchMedia`; stubbing it to match
// lets `useCompact` return true and `PlacesList` render its cards.
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

function Harness({ children }: { children: React.ReactNode }) {
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
        <AuthProvider userManager={userManager}>
          <NotifyProvider>
            <QueryClientProvider client={client}>
              <MemoryRouter initialEntries={["/places"]}>{children}</MemoryRouter>
            </QueryClientProvider>
          </NotifyProvider>
        </AuthProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  userManager = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] }),
  );
  installClient({
    config: testConfig,
    userManager,
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  server.resetHandlers();
});

describe("PlacesList (admin.md 6.24)", () => {
  it("renders the tree with parent, child, and their location cells", async () => {
    render(
      <Harness>
        <PlacesList />
      </Harness>,
    );
    // Parent (has scans, no pin) => warning.
    await screen.findByRole("link", { name: "Southgate Mall" });
    expect(screen.getByText("Not pinned yet")).toBeInTheDocument();
    // Child (no scans, no pin) => muted "No pin".
    expect(screen.getByRole("link", { name: "West wing" })).toBeInTheDocument();
    expect(screen.getByText("No pin")).toBeInTheDocument();
  });

  it("New place posts to the API with the trimmed name", async () => {
    const seen: Array<Record<string, unknown>> = [];
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/places`, async ({ request }) => {
        seen.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          {
            id: 999,
            parentId: null,
            name: "Farmers' market",
            description: "",
            path: ["Farmers' market"],
            opensPageId: null,
            forwardUrl: null,
            opens: { kind: "home" },
            opensSource: "home",
            location: null,
            pin: null,
            codes: [],
            scans: { people: 0 },
            createdBy: "admin@example.com",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            audit: null,
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    render(
      <Harness>
        <PlacesList />
      </Harness>,
    );
    await screen.findByRole("link", { name: "Southgate Mall" });

    await user.click(screen.getByRole("button", { name: /new place$/i }));
    const dialog = await screen.findByRole("dialog", { name: /new place/i });
    const nameInput = await within(dialog).findByLabelText(/name/i);
    await user.type(nameInput, "  Farmers' market  ");
    await user.click(within(dialog).getByRole("button", { name: /create/i }));

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]?.name).toBe("Farmers' market");
    expect(seen[0]?.parentId).toBeNull();
  });

  it("renders a card per place on compact with the depth indentation and no desktop table", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(
        <Harness>
          <PlacesList />
        </Harness>,
      );
      const parentCard = await screen.findByTestId("place-row-1");
      const childCard = await screen.findByTestId("place-row-2");
      // Parent depth 0 (pl 0), child depth 1 (pl 2 * 8 = 16px).
      expect(parentCard).toHaveStyle({ paddingLeft: "0px" });
      expect(childCard).toHaveStyle({ paddingLeft: "16px" });
      // Both cards carry their edit pencil.
      expect(
        within(parentCard).getByRole("link", { name: /edit southgate mall/i }),
      ).toBeInTheDocument();
      expect(
        within(childCard).getByRole("link", { name: /edit west wing/i }),
      ).toBeInTheDocument();
      // The desktop table does not render on compact.
      expect(screen.queryByRole("table")).toBeNull();
    } finally {
      restore();
    }
  });
});


describe("PlacesList delete refusals", () => {
  it("shows the API's message when a delete is refused and keeps the row", async () => {
    server.use(
      http.delete(`${testConfig.apiBaseUrl}/admin/places/:id`, () =>
        HttpResponse.json(
          { code: "internal_error", message: "internal error", details: null },
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    render(
      <Harness>
        <PlacesList />
      </Harness>,
    );
    await screen.findByRole("link", { name: "Southgate Mall" });

    await user.click(screen.getByRole("button", { name: /actions for southgate mall/i }));
    await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /delete southgate mall/i,
    });
    // Wait for the impact preview to load before the confirm enables.
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /^delete$/i })).toBeEnabled(),
    );
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await screen.findByText(/internal error/i);
    expect(screen.getByRole("link", { name: "Southgate Mall" })).toBeInTheDocument();
  });
});
