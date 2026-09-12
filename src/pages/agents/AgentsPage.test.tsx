import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import AgentsPage from "./AgentsPage";
import { buildAgentPrompt } from "./agentPrompt";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

function Harness() {
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
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/agents"]}>
            <NotifyProvider>
              <AgentsPage />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/api-keys`, () =>
      HttpResponse.json({ items: [] })
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("AgentsPage", () => {
  it("renders the session steps, the keys table, and the prompt with this environment's base URL", async () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByText("How a session works")).toBeInTheDocument();
    expect(await screen.findByText("No keys yet.")).toBeInTheDocument();
    const block = screen.getByTestId("agent-prompt-block");
    expect(block.textContent).toContain(`Base URL: ${testConfig.apiBaseUrl}`);
    expect(block.textContent).toContain("POST /admin/content/publish");
    expect(screen.getByTestId("copy-prompt-button")).toBeInTheDocument();
  });

  it("the prompt names every capability group and the Cognito-only key endpoints", () => {
    const prompt = buildAgentPrompt("https://api.example");
    for (const cap of [
      "pages:",
      "sections:",
      "site_settings:",
      "content:",
      "media:",
      "icons:",
      "sponsors:",
      "events:",
      "routes:",
      "cookie_types:",
      "cookies:",
      "settings:",
      "contact_messages, subscribers, people:",
      "beacons:",
      "diagnostics:",
    ]) {
      expect(prompt).toContain(`- ${cap}`);
    }
    expect(prompt).toContain("/admin/api-keys");
    expect(prompt).not.toMatch(/[\u2013\u2014]/);
  });
});
