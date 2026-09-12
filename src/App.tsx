import { useEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import type { UserManager } from "oidc-client-ts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Config } from "./config";
import AuthProvider, { useAuth } from "./auth/AuthProvider";
import { ConfigProvider } from "./ConfigContext";
import { installClient } from "./api/client";
import { installCdn } from "./api/cdn";
import AppRoutes from "./AppRoutes";
import { buildTheme, type AppThemeMode } from "./theme/theme";
import { getStoredTheme, setStoredTheme } from "./theme/themeStorage";

interface AppProps {
  config: Config;
  userManager: UserManager;
  queryClient?: QueryClient;
}

function defaultQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}

export default function App({ config, userManager, queryClient }: AppProps) {
  const [themeMode, setThemeMode] = useState<AppThemeMode>(getStoredTheme);
  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);
  const client = useMemo(() => queryClient ?? defaultQueryClient(), [queryClient]);

  const toggleTheme = () => {
    setThemeMode((prev) => {
      const next: AppThemeMode = prev === "light" ? "dark" : "light";
      setStoredTheme(next);
      return next;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConfigProvider config={config}>
        <QueryClientProvider client={client}>
          <AuthProvider userManager={userManager}>
            <ClientInstaller config={config} userManager={userManager} />
            <AppRoutes themeMode={themeMode} onToggleTheme={toggleTheme} />
          </AuthProvider>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

interface ClientInstallerProps {
  config: Config;
  userManager: UserManager;
}

function ClientInstaller({ config, userManager }: ClientInstallerProps) {
  const { requireMfa } = useAuth();
  useEffect(() => {
    installClient({ config, userManager, onMfaRequired: requireMfa });
    installCdn({ cdnBaseUrl: config.cdnBaseUrl });
  }, [config, userManager, requireMfa]);
  return null;
}
