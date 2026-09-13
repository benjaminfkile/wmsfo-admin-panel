// admin.md 6.23 QR code detail: history card, three stats, daily chart
// rendered inline from fixtures.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import QrCodeDetail from "./QrCodeDetail";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { NotifyProvider } from "../../hooks/useNotify";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

vi.mock("./qrRender", () => ({
  qrTargetUrl: (base: string, tag: string) => `${base}/q/${tag}`,
  renderSvg: () =>
    Promise.resolve('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'),
  renderPngDataUrlMm: () => Promise.resolve("data:image/png;base64,AAAA"),
}));

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
        <NotifyProvider>
          <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={["/qr-codes/100"]}>
              <Routes>
                <Route path="/qr-codes/:id" element={<QrCodeDetail />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </NotifyProvider>
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

describe("QrCodeDetail (admin.md 6.23)", () => {
  it("renders the history card, the three stats, and the daily chart", async () => {
    render(<Harness />);
    await screen.findByRole("heading", { name: /qr code qr-001/i });
    // History cell text.
    expect(screen.getByText(/Where it has been/i)).toBeInTheDocument();
    // Early scans note formatting.
    expect(
      screen.getByText(/includes 2 scans from the hour before/i)
    ).toBeInTheDocument();
    // The three stat cards.
    expect(screen.getByText(/People \(all attachments\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Flagged hits/i)).toBeInTheDocument();
    expect(screen.getByText(/People per day \(14 days\)/i)).toBeInTheDocument();
    // The inline SVG daily chart.
    expect(screen.getByTestId("qr-daily-chart")).toBeInTheDocument();
  });
});
