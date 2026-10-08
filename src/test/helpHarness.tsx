import type { ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UserManager } from "oidc-client-ts";
import AuthProvider from "../auth/AuthProvider";
import { ConfigProvider } from "../ConfigContext";
import { installClient } from "../api/client";
import { NotifyProvider } from "../hooks/useNotify";
import { buildTheme } from "../theme/theme";
import type { Role } from "../auth/claims";
import { makeFakeUserManager, makeUser, testConfig } from "./renderWithProviders";

// A signed-in user of the given role with the API client installed, for
// the help components' tests.
export function signInAs(role: Role): UserManager {
  const um = makeFakeUserManager(
    makeUser({ email: `${role}@example.com`, "cognito:groups": [role] })
  );
  installClient({ config: testConfig, userManager: um, onMfaRequired: () => undefined });
  return um;
}

export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

export function HelpHarness({
  userManager,
  route = "/",
  children,
}: {
  userManager: UserManager;
  route?: string;
  children: ReactNode;
}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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
              <MemoryRouter initialEntries={[route]}>
                {children}
                <LocationProbe />
              </MemoryRouter>
            </QueryClientProvider>
          </NotifyProvider>
        </AuthProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

// jsdom has no `window.matchMedia`; this stub answers every query with
// `matches`, so `true` puts `useCompact` and `AppDialog` on compact.
export function stubMatchMedia(matches: boolean): () => void {
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
