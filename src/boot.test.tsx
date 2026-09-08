import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { loadConfig } from "./config";
import ConfigError from "./pages/auth/ConfigError";
import { buildTheme } from "./theme/theme";

describe("boot", () => {
  it("renders ConfigError and makes no request when a variable is missing", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = loadConfig({
      VITE_ENV: "dev",
      VITE_API_BASE_URL: "",
      VITE_CDN_BASE_URL: "https://cdn.test",
      VITE_COGNITO_AUTHORITY: "https://cognito.test",
      VITE_COGNITO_DOMAIN: "https://auth.test",
      VITE_COGNITO_CLIENT_ID: "client",
    } as unknown as ImportMetaEnv);

    expect("missing" in result).toBe(true);
    if ("missing" in result) {
      render(
        <ThemeProvider theme={buildTheme("light")}>
          <CssBaseline />
          <ConfigError missing={result.missing} />
        </ThemeProvider>
      );
      expect(
        screen.getByRole("heading", { name: /configuration error/i })
      ).toBeInTheDocument();
      expect(screen.getByText("VITE_API_BASE_URL")).toBeInTheDocument();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
