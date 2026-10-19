import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import App from "../App";
import type { AppEnv } from "../config";
import { buildTheme } from "../theme/theme";
import { makeFakeUserManager, testConfig } from "../test/renderWithProviders";

function renderApp(env: AppEnv) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <App
        config={{ ...testConfig, env }}
        userManager={makeFakeUserManager(null)}
        queryClient={client}
      />
    </MemoryRouter>
  );
}

const theme = buildTheme("light");

describe("EnvFrame", () => {
  it.each([
    ["prod", theme.palette.error.main],
    ["dev", theme.palette.success.main],
    ["local", theme.palette.info.main],
  ] as const)("draws the %s frame in its colour", async (env, colour) => {
    renderApp(env);
    const frame = await screen.findByTestId("env-frame");
    expect(frame).toHaveAttribute("data-env", env);
    expect(getComputedStyle(frame).boxShadow).toBe(`inset 0 0 0 3px ${colour}`);
  });

  it("is fixed to the viewport, above every MUI layer, and never takes a click", async () => {
    renderApp("dev");
    const style = getComputedStyle(await screen.findByTestId("env-frame"));
    expect(style.pointerEvents).toBe("none");
    expect(style.position).toBe("fixed");
    expect(Number(style.zIndex)).toBe(theme.zIndex.tooltip + 1);
  });

  it("shows on the sign-in route", async () => {
    renderApp("prod");
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByTestId("env-frame")).toHaveAttribute("data-env", "prod");
  });
});
