import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import ApiKeysList from "./ApiKeysList";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
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
          <MemoryRouter initialEntries={["/api-keys"]}>
            <NotifyProvider>
              <ApiKeysList />
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
});

afterEach(() => {
  server.resetHandlers();
});

describe("ApiKeysList", () => {
  it("renders one row per key with name, prefix and status", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(`api-key-row-${f.apiKeys[0]!.id}`);
    expect(within(row).getByText(f.apiKeys[0]!.name!)).toBeInTheDocument();
    expect(
      within(row).getByText(f.apiKeys[0]!.keyPrefix!)
    ).toBeInTheDocument();
    expect(within(row).getByText("Active")).toBeInTheDocument();
    // The 'All capabilities' key shows the "All" chip.
    const all = await screen.findByTestId(`api-key-row-${f.apiKeys[1]!.id}`);
    expect(within(all).getByText("All")).toBeInTheDocument();
  });

  it("mints a key and reveals it exactly once through KeyRevealDialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("button", { name: /new key/i });
    await user.click(screen.getByRole("button", { name: /new key/i }));

    await user.type(screen.getByLabelText(/^name$/i), "new-key");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    // Reveal dialog with the key and no QR image (api-keys flow).
    const key = await screen.findByLabelText(/^key$/i);
    expect(key).toHaveValue(`wak_${"a".repeat(43)}`);
    expect(screen.queryByAltText(/enrolment qr code/i)).toBeNull();
    expect(screen.queryByLabelText(/enrolment url/i)).toBeNull();
    expect(
      await screen.findByRole("button", { name: /i have stored the key/i })
    ).toBeInTheDocument();
  });

  it("shows a name_taken field error on 409", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/api-keys`, () =>
        HttpResponse.json(
          {
            code: "name_taken",
            message: "already exists",
            details: null,
            requestId: "r1",
          },
          { status: 409 }
        )
      )
    );
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /new key/i }));
    await user.type(screen.getByLabelText(/^name$/i), "claude-code");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(
      await screen.findByText(
        /a key with this name exists; revoke it or pick another name/i
      )
    ).toBeInTheDocument();
  });

  it("revokes a key after the confirmation dialog", async () => {
    const user = userEvent.setup();
    let revokedId: string | null = null;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/api-keys/:id/revoke`,
        ({ params }) => {
          revokedId = String(params.id);
          return HttpResponse.json({
            ...f.apiKeys[0],
            revokedAt: "2026-12-22T02:00:00.000Z",
          });
        }
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId(`api-key-row-${f.apiKeys[0]!.id}`);
    await user.click(
      within(row).getByRole("button", { name: /actions for/i })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^revoke$/i })
    );
    expect(
      await screen.findByText(/anything using it stops working immediately/i)
    ).toBeInTheDocument();
    const confirmBtn = screen
      .getAllByRole("button", { name: /^revoke$/i })
      .find((b) => b.tagName === "BUTTON" && !b.closest("tr"));
    if (!confirmBtn) throw new Error("confirm button not found");
    await user.click(confirmBtn);
    await waitFor(() => expect(revokedId).toBe(String(f.apiKeys[0]!.id)));
  });
});
