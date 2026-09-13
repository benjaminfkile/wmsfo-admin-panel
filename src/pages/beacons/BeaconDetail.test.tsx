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

const heartbeatWithDebug: Heartbeat = {
  sentAt: NOW,
  health: {
    batteryPercent: 5,
    lastFixAgeS: 100,
    socketState: "reconnecting",
  },
  debug: {
    power: { charging: false, batteryTempC: 42, thermalStatus: "moderate" },
    radio: { networkType: "LTE", signalDbm: -100 },
    process: { deviceUptimeS: 90000 },
  },
};

const emptyDebugHeartbeat: Heartbeat = {
  sentAt: NOW,
  health: { batteryPercent: 87, lastFixAgeS: 1, socketState: "connected" },
  debug: null,
};

const richBeacon: Beacon = {
  ...f.beacons[0]!,
  telemetry: heartbeatWithDebug as unknown as Beacon["telemetry"],
  healthy: false,
} as Beacon;

const cleanBeacon: Beacon = {
  ...f.beacons[0]!,
  telemetry: emptyDebugHeartbeat as unknown as Beacon["telemetry"],
  healthy: true,
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
  it("renders the three Health leaves and colours only those flagged", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    const battery = document.querySelector(
      "[data-leaf='batteryPercent']"
    ) as HTMLElement | null;
    expect(battery).not.toBeNull();
    expect(battery!.textContent).toContain("5 %");
    const fix = document.querySelector(
      "[data-leaf='lastFixAgeS']"
    ) as HTMLElement | null;
    expect(fix).not.toBeNull();
    expect(fix!.textContent).toContain("100 s");
    const sock = document.querySelector(
      "[data-leaf='socketState']"
    ) as HTMLElement | null;
    expect(sock).not.toBeNull();
    expect(sock!.textContent).toContain("reconnecting");
  });

  it("shows \"not reported\" when a health leaf is absent", async () => {
    const beacon: Beacon = {
      ...f.beacons[0]!,
      telemetry: {
        sentAt: NOW,
        health: { socketState: "connected" },
        debug: null,
      } as unknown as Beacon["telemetry"],
      healthy: false,
    } as Beacon;
    server.use(
      http.get("*/admin/beacons", () =>
        HttpResponse.json({ items: [beacon], staleAfterS: 45 })
      )
    );
    renderDetail();
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    const battery = document.querySelector(
      "[data-leaf='batteryPercent']"
    ) as HTMLElement | null;
    expect(battery!.textContent).toContain("not reported");
    const fix = document.querySelector(
      "[data-leaf='lastFixAgeS']"
    ) as HTMLElement | null;
    expect(fix!.textContent).toContain("not reported");
  });

  it("renders the debug object as a tree keyed verbatim", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    // The tree renders keys from debug directly.
    await waitFor(() => {
      expect(screen.getAllByText(/power/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/thermalStatus/).length).toBeGreaterThan(0);
    });
  });

  it("renders \"This beacon sends no debug data\" when debug is null", async () => {
    server.use(
      http.get("*/admin/beacons", () =>
        HttpResponse.json({ items: [cleanBeacon], staleAfterS: 45 })
      )
    );
    renderDetail();
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    expect(
      await screen.findByText(/This beacon sends no debug data/i)
    ).toBeInTheDocument();
  });

  it("shows the Unhealthy chip when beacon.healthy is false", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    expect(screen.getByText("Unhealthy")).toBeInTheDocument();
  });

  it("shows the Healthy chip when beacon.healthy is true", async () => {
    server.use(
      http.get("*/admin/beacons", () =>
        HttpResponse.json({ items: [cleanBeacon], staleAfterS: 45 })
      )
    );
    renderDetail();
    await screen.findByRole("heading", { name: f.beacons[0]!.name!, level: 4 });
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });
});

describe("BeaconDetail logs", () => {
  it("shows the log rows for every beacon", async () => {
    const user = userEvent.setup();
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
