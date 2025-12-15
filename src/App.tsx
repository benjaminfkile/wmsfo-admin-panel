import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { setRuntimeConfig } from "./auth/runtimeConfig";

import {
  CircularProgress,
  Box,
  Alert,
  CssBaseline,
  ThemeProvider,
} from "@mui/material";

import MainLayout from "./components/MainLayout";
import { buildTheme, AppThemeMode } from "./theme/theme";
import {
  getStoredTheme,
  setStoredTheme,
} from "./theme/themeStorage";

import ApiKeyPrompt from "./components/ApiKeyPrompt";

export default function App() {

  const [themeMode, setThemeMode] = useState<AppThemeMode>(getStoredTheme);

  const theme = useMemo(
    () => buildTheme(themeMode),
    [themeMode]
  );

  const toggleTheme = () => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      setStoredTheme(next);
      return next;
    });
  };


  const hasSecrets =
    !!localStorage.getItem("chrisTrackerAuth") &&
    !!localStorage.getItem("secretSanta") &&
    !!localStorage.getItem("protectedRoutePrefix");

  const [needsSetup, setNeedsSetup] = useState(!hasSecrets);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (needsSetup) return;

    api.dashboardConfig
      .get()
      .then((res) => {
        setRuntimeConfig(
          res.secrets.protectedRoutePrefix,
          res.secrets.chrisTrackerAuth,
          res.secrets.secretSanta
        );
        setReady(true);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to initialize app");
      });
  }, [needsSetup]);


  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }


  if (needsSetup) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ApiKeyPrompt
          onSaved={() => {
            setNeedsSetup(false);
            setReady(false);
          }}
        />
      </ThemeProvider>
    );
  }


  if (!ready) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MainLayout
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />
    </ThemeProvider>
  );
}
