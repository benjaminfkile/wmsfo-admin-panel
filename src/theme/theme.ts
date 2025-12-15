import { createTheme, Theme } from "@mui/material/styles";

export type AppThemeMode = "light" | "dark";

export function buildTheme(mode: AppThemeMode): Theme {
  return createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? {
            background: {
              default: "#121212",
              paper: "#1e1e1e",
            },
          }
        : {}),
    },
  });
}
