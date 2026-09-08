import type { ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline } from "@mui/material";
import type { User, UserManager } from "oidc-client-ts";
import AuthProvider from "../auth/AuthProvider";
import { ConfigProvider } from "../ConfigContext";
import type { Config } from "../config";
import { buildTheme } from "../theme/theme";

export type FakeUserManager = UserManager & {
  __fireUserLoaded: (u: User) => void;
  __fireUserUnloaded: () => void;
  __fireSilentRenewError: () => void;
  __fireAccessTokenExpired: () => void;
};

export function makeFakeUserManager(initialUser: User | null): FakeUserManager {
  const listeners: {
    loaded: Array<(u: User) => void>;
    unloaded: Array<() => void>;
    silent: Array<() => void>;
    expired: Array<() => void>;
  } = { loaded: [], unloaded: [], silent: [], expired: [] };

  let current = initialUser;

  const um: unknown = {
    getUser: async () => current,
    signinSilent: async () => current,
    signinRedirect: async () => undefined,
    signinCallback: async () => current,
    removeUser: async () => {
      current = null;
    },
    revokeTokens: async () => undefined,
    events: {
      addUserLoaded: (fn: (u: User) => void) => listeners.loaded.push(fn),
      removeUserLoaded: (fn: (u: User) => void) => {
        listeners.loaded = listeners.loaded.filter((x) => x !== fn);
      },
      addUserUnloaded: (fn: () => void) => listeners.unloaded.push(fn),
      removeUserUnloaded: (fn: () => void) => {
        listeners.unloaded = listeners.unloaded.filter((x) => x !== fn);
      },
      addSilentRenewError: (fn: () => void) => listeners.silent.push(fn),
      removeSilentRenewError: (fn: () => void) => {
        listeners.silent = listeners.silent.filter((x) => x !== fn);
      },
      addAccessTokenExpired: (fn: () => void) => listeners.expired.push(fn),
      removeAccessTokenExpired: (fn: () => void) => {
        listeners.expired = listeners.expired.filter((x) => x !== fn);
      },
    },
    __fireUserLoaded: (u: User) => {
      current = u;
      listeners.loaded.forEach((fn) => fn(u));
    },
    __fireUserUnloaded: () => {
      current = null;
      listeners.unloaded.forEach((fn) => fn());
    },
    __fireSilentRenewError: () => {
      listeners.silent.forEach((fn) => fn());
    },
    __fireAccessTokenExpired: () => {
      listeners.expired.forEach((fn) => fn());
    },
  };
  return um as FakeUserManager;
}

export function makeUser(profile: Record<string, unknown>): User {
  return {
    profile,
    id_token: "id-token",
    access_token: "access-token",
    refresh_token: "refresh-token",
    expired: false,
  } as unknown as User;
}

export const testConfig: Config = {
  env: "dev",
  apiBaseUrl: "https://api.test",
  cdnBaseUrl: "https://cdn.test",
  cognitoAuthority: "https://cognito.test/pool",
  cognitoDomain: "https://auth.test",
  cognitoClientId: "client-test",
};

interface ProvidersProps {
  userManager: UserManager;
  config?: Config;
  route?: string;
  children: ReactNode;
}

export function AllProviders({
  userManager,
  config = testConfig,
  route = "/",
  children,
}: ProvidersProps) {
  const theme = buildTheme("light");
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConfigProvider config={config}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[route]}>
            <AuthProvider userManager={userManager}>{children}</AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(
  ui: ReactNode,
  opts: { userManager: UserManager; config?: Config; route?: string }
): RenderResult {
  return render(
    <AllProviders
      userManager={opts.userManager}
      config={opts.config}
      route={opts.route}
    >
      {ui}
    </AllProviders>
  );
}
