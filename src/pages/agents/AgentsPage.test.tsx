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

  it("the prompt names all 18 capabilities with the routes each reaches", () => {
    const prompt = buildAgentPrompt("https://api.example");
    const caps = [
      "events",
      "routes",
      "beacons",
      "sponsors",
      "cookie_types",
      "pages",
      "sections",
      "site_settings",
      "content",
      "media",
      "icons",
      "settings",
      "contact_messages",
      "subscribers",
      "people",
      "diagnostics",
      "audit",
      "qr",
    ];
    expect(caps).toHaveLength(18);
    for (const cap of caps) {
      expect(prompt).toContain(`- \`${cap}\`: `);
      expect(prompt).toContain(`### ${cap}\n`);
    }
    expect(prompt).toContain("There are 18.");
  });

  it("the prompt lists the five Cognito-only routes", () => {
    const prompt = buildAgentPrompt("https://api.example");
    for (const route of [
      "  - GET /admin/api-keys\n",
      "  - POST /admin/api-keys\n",
      "  - POST /admin/api-keys/{id}/revoke\n",
      "  - GET /admin/api-keys/{id}/impact\n",
      "  - GET /admin/email/quota\n",
    ]) {
      expect(prompt).toContain(route);
    }
  });

  it("the prompt names the POSTs that answer 200", () => {
    const prompt = buildAgentPrompt("https://api.example");
    const line = prompt.split("\n").find((l) => l.includes("These POSTs answer 200, not 201"));
    expect(line).toBeDefined();
    for (const route of [
      "POST /admin/events/{id}/status",
      "POST /admin/events/{id}/current",
      "POST /admin/events/{id}/notify",
      "POST /admin/qr-codes/{id}/attach",
      "POST /admin/qr-codes/{id}/detach",
      "POST /admin/beacons/{id}/activate",
      "POST /admin/beacons/{id}/deactivate",
      "POST /admin/beacons/{id}/rotate",
      "POST /admin/beacons/{id}/revoke",
      "POST /admin/content/versions/{id}/restore",
      "PUT /admin/sponsors/{id}/years/{eventYear}",
      "POST /admin/routes answers 200 with the existing row when an identical recording exists",
    ]) {
      expect(line).toContain(route);
    }
  });

  it("the prompt carries none of the stale statements and no dashes", () => {
    const prompt = buildAgentPrompt("https://api.example");
    for (const stale of ["SVG only", "1 to 100", "16 capabilities", "tight|normal|loose|none"]) {
      expect(prompt).not.toContain(stale);
    }
    expect(prompt).not.toMatch(/[\u2013\u2014]/);
  });
});
