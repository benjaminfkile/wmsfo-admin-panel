import { act } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthProvider, { useAuth } from "./AuthProvider";
import { ConfigProvider } from "../ConfigContext";
import AppRoutes from "../AppRoutes";
import { installClient } from "../api/client";
import { buildTheme } from "../theme/theme";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
  type FakeUserManager,
} from "../test/renderWithProviders";
import type { User } from "oidc-client-ts";
import { http, HttpResponse } from "msw";
import { server } from "../test/msw/server";

function Harness({ userManager }: { userManager: FakeUserManager }) {
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ConfigProvider config={testConfig}>
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
              },
            })
          }
        >
          <MemoryRouter initialEntries={["/"]}>
            <AuthProvider userManager={userManager}>
              <MfaInstaller userManager={userManager} />
              <AppRoutes themeMode="light" onToggleTheme={() => undefined} />
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

function MfaInstaller({ userManager }: { userManager: FakeUserManager }) {
  const { requireMfa } = useAuth();
  installClient({
    config: testConfig,
    userManager,
    onMfaRequired: requireMfa,
  });
  return null;
}

async function fire(um: FakeUserManager, fn: () => void) {
  await act(async () => {
    fn();
  });
}

describe("Auth guard", () => {
  it("shows a spinner while loading", async () => {
    let resolveGetUser: (u: User | null) => void = () => undefined;
    const um = makeFakeUserManager(null);
    um.getUser = () =>
      new Promise<User | null>((resolve) => {
        resolveGetUser = resolve;
      });
    render(<Harness userManager={um} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await act(async () => {
      resolveGetUser(null);
    });
    await screen.findByRole("button", { name: /sign in/i });
  });

  it("shows SignIn when there is no user", async () => {
    const um = makeFakeUserManager(null);
    render(<Harness userManager={um} />);
    await screen.findByRole("button", { name: /sign in/i });
  });

  it("shows NoRole for a signed-in user without a group", async () => {
    const um = makeFakeUserManager(
      makeUser({ email: "user@example.com" })
    );
    render(<Harness userManager={um} />);
    expect(
      await screen.findByText(/this account has no role/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });

  it("renders the full drawer for an admin", async () => {
    const um = makeFakeUserManager(
      makeUser({
        email: "admin@example.com",
        "cognito:groups": ["admin"],
      })
    );
    render(<Harness userManager={um} />);
    for (const label of [
      "Dashboard",
      "Events",
      "Routes",
      "Beacons",
      "Pages",
      "Media",
      "Site settings",
      "Publish",
      "Sponsors",
      "Cookie types",
      "Cookies",
      "Subscribers",
      "People",
      "Contact messages",
      "Settings",
    ]) {
      expect(
        (await screen.findAllByText(label)).length
      ).toBeGreaterThan(0);
    }
  });

  it("renders exactly five drawer entries for an editor", async () => {
    const um = makeFakeUserManager(
      makeUser({
        email: "editor@example.com",
        "cognito:groups": ["editor"],
      })
    );
    render(<Harness userManager={um} />);
    await screen.findAllByText("Pages");
    for (const label of ["Pages", "Media", "Site settings", "Publish", "Sponsors"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const forbidden of [
      "Dashboard",
      "Events",
      "Routes",
      "Beacons",
      "Cookie types",
      "Cookies",
      "Subscribers",
      "People",
      "Contact messages",
      "Settings",
    ]) {
      expect(screen.queryAllByText(forbidden)).toHaveLength(0);
    }
  });

  it("switches to NoRole when a userLoaded event lands without a group", async () => {
    const um = makeFakeUserManager(
      makeUser({
        email: "admin@example.com",
        "cognito:groups": ["admin"],
      })
    );
    render(<Harness userManager={um} />);
    await screen.findAllByText("Dashboard");
    await fire(um, () =>
      um.__fireUserLoaded(makeUser({ email: "admin@example.com" }))
    );
    expect(
      await screen.findByText(/this account has no role/i)
    ).toBeInTheDocument();
  });

  it("switches to MfaSetup when the API client reports mfa_required", async () => {
    const um = makeFakeUserManager(
      makeUser({
        email: "admin@example.com",
        "cognito:groups": ["admin"],
      })
    );
    render(<Harness userManager={um} />);
    await screen.findAllByText("Dashboard");
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
        HttpResponse.json(
          {
            code: "mfa_required",
            message: "MFA required",
            details: null,
            requestId: "req-1",
          },
          { status: 403 }
        )
      )
    );
    const { request } = await import("../api/client");
    await act(async () => {
      await request({ method: "GET", path: "/admin/events" }).catch(
        () => undefined
      );
    });
    expect(await screen.findByText(/set up mfa/i)).toBeInTheDocument();
  });

  it("signs out when userUnloaded fires", async () => {
    const um = makeFakeUserManager(
      makeUser({
        email: "admin@example.com",
        "cognito:groups": ["admin"],
      })
    );
    render(<Harness userManager={um} />);
    await screen.findAllByText("Dashboard");
    await fire(um, () => um.__fireUserUnloaded());
    await screen.findByRole("button", { name: /sign in/i });
  });

  it("marks a route the role cannot access as Not available", async () => {
    const um = makeFakeUserManager(
      makeUser({
        email: "editor@example.com",
        "cognito:groups": ["editor"],
      })
    );
    render(
      <ThemeProvider theme={buildTheme("light")}>
        <CssBaseline />
        <ConfigProvider config={testConfig}>
          <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={["/settings"]}>
              <AuthProvider userManager={um}>
                <AppRoutes themeMode="light" onToggleTheme={() => undefined} />
              </AuthProvider>
            </MemoryRouter>
          </QueryClientProvider>
        </ConfigProvider>
      </ThemeProvider>
    );
    await waitFor(() =>
      expect(
        screen.getByText(/not available for your role/i)
      ).toBeInTheDocument()
    );
  });

  it("has a working sign-in button that calls signinRedirect", async () => {
    const um = makeFakeUserManager(null);
    let called = 0;
    um.signinRedirect = async () => {
      called += 1;
    };
    render(<Harness userManager={um} />);
    const btn = await screen.findByRole("button", { name: /sign in/i });
    await userEvent.click(btn);
    await waitFor(() => expect(called).toBe(1));
  });
});
