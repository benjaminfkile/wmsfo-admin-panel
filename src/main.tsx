import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ConfigError from "./pages/auth/ConfigError";
import { loadConfig } from "./config";
import { createUserManager } from "./auth/userManager";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { buildTheme } from "./theme/theme";
import { getStoredTheme } from "./theme/themeStorage";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element missing");
const root = createRoot(rootEl);

const result = loadConfig();

if ("missing" in result) {
  const theme = buildTheme(getStoredTheme());
  root.render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ConfigError missing={result.missing} />
      </ThemeProvider>
    </StrictMode>
  );
} else {
  const { config } = result;
  if (config.env !== "prod") {
    const tag = config.env === "dev" ? "[DEV] " : "[LOCAL] ";
    if (!document.title.startsWith(tag)) {
      document.title = tag + document.title;
    }
  }
  const userManager = createUserManager(config);
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App config={config} userManager={userManager} />
      </BrowserRouter>
    </StrictMode>
  );
}
