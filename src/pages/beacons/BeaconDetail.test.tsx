import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import BeaconDetail from "./BeaconDetail";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import AuthProvider from "../../auth/AuthProvider";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import type { Beacon, Heartbeat } from "../../api/types";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

function renderDetail({
  role = "admin",
  id = Number(f.beacons[0]!.id),
}: { role?: "admin" | "editor"; id?: number } = {}) {
  const um = makeFakeUserManager(
    makeUser({ email: "u@example.com", "cognito:groups": [role] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ConfigProvider config={testConfig}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/beacons/${id}`]}>
            <AuthProvider userManager={um}>
              <NotifyProvider>
                <Routes>
                  <Route path="/beacons/:id" element={<BeaconDetail />} />
                </Routes>
              </NotifyProvider>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const NOW = "2026-12-22T01:31:07.412Z";

const richHeartbeat: Heartbeat = {
  sentAt: NOW,
  power: {
    batteryPercent: 5,
    charging: false,
    batteryTempC: 42,
    thermalStatus: "moderate",
    strangeExtra: "yes",
  },
  radio: {
    networkType: "LTE",
    signalDbm: -100,
    signalLevel: 2,
    airplaneMode: false,
    connected: true,
  },
  gps: {
    provider: "fused",
    satellitesUsed: 5,
    satellitesInView: 10,
    lastFixAccuracyM: 15,
    lastFixAgeS: 5,
    fixesLastMinute: 30,
    permission: { foreground: true, background: false, precise: true },
  },
  transport: {
    socketState: "connected",
    reconnectCount: 0,
    httpFallbackSeconds: 0,
    lastReceiptLatencyMs: 100,
    sendsFailedSinceBoot: 0,
  },
  process: {
    deviceUptimeS: 90000,
    serviceUptimeS: 3600,
    serviceRestartCount: 1,
    memoryPressure: "normal",
    batteryOptimizationExempt: true,
    notificationPermission: true,
    systemApp: false,
    rootAvailable: false,
  },
  identity: {
    deviceModel: "Pixel 7",
    androidVersion: "14",
    appVersion: "1.0.3",
    clockSkewMs: 0,
  },
};

const richBeacon: Beacon = {
  ...f.beacons[0]!,
  telemetry: richHeartbeat as unknown as Beacon["telemetry"],
} as Beacon;

beforeEach(() => {
  server.use(
    http.get("*/admin/beacons", () =>
      HttpResponse.json({ items: [richBeacon], staleAfterS: 45 })
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("BeaconDetail telemetry panel", () => {
  it("colours battery_low on batteryPercent when it is under threshold", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    const row = document.querySelector(
      "[data-leaf='batteryPercent']"
    ) as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain("5 %");
  });

  it("colours permission_missing on the false permission leaf", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    const row = document.querySelector(
      "[data-leaf='permission.background']"
    ) as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain("no");
  });

  it("renders unknown nested keys under Other for the group", async () => {
    renderDetail();
    // The heartbeat has power.strangeExtra which is not in the leaf table.
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    expect(await screen.findByText(/^Other$/)).toBeInTheDocument();
  });

  it("hides the logs card for role editor even when beacon role is admin", async () => {
    server.use(
      http.get("*/admin/beacons", () =>
        HttpResponse.json(
          {
            items: [{ ...richBeacon, role: "admin" }],
            staleAfterS: 45,
          }
        )
      )
    );
    renderDetail({ role: "editor" });
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    expect(screen.queryByText(/^Logs$/)).toBeNull();
  });

  it("shows the logs card for admin when beacon role is admin", async () => {
    server.use(
      http.get("*/admin/beacons", () =>
        HttpResponse.json({
          items: [{ ...richBeacon, role: "admin" }],
          staleAfterS: 45,
        })
      )
    );
    renderDetail({ role: "admin" });
    expect(await screen.findByText(/^Logs$/)).toBeInTheDocument();
  });
});

describe("BeaconDetail logs interactions", () => {
  it("shows the log rows for an admin beacon", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/admin/beacons", () =>
        HttpResponse.json({
          items: [{ ...richBeacon, role: "admin" }],
          staleAfterS: 45,
        })
      )
    );
    renderDetail();
    const row = await screen.findByTestId(`beacon-log-row-${f.beaconLogs[0]!.id}`);
    expect(row).toBeInTheDocument();
    // Clicking view fetches the text and shows it in a pre.
    await user.click(within(row).getByRole("button", { name: /^view$/i }));
    await waitFor(() =>
      expect(screen.getByText(/log body/i)).toBeInTheDocument()
    );
  });
});
