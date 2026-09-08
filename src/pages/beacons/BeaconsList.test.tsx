import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import BeaconsList from "./BeaconsList";
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
          <MemoryRouter initialEntries={["/beacons"]}>
            <NotifyProvider>
              <BeaconsList />
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

describe("BeaconsList", () => {
  it("renders one row per beacon with name, role and key prefix", async () => {
    render(<Harness />);
    await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
    const row = screen.getByTestId(`beacon-row-${f.beacons[0]!.id}`);
    expect(within(row).getByText(f.beacons[0]!.name!)).toBeInTheDocument();
    expect(within(row).getByText(f.beacons[0]!.role!)).toBeInTheDocument();
    expect(
      within(row).getByText(f.beacons[0]!.keyPrefix!)
    ).toBeInTheDocument();
  });

  it("shows the Active chip on the active beacon", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
    expect(within(row).getByText("Active")).toBeInTheDocument();
  });

  it("opens the create dialog and shows the role text", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const newBtn = await screen.findByRole("button", { name: /new beacon/i });
    await user.click(newBtn);
    expect(
      await screen.findByText(/role cannot be changed later/i)
    ).toBeInTheDocument();
    expect(await screen.findByLabelText(/^name$/i)).toBeInTheDocument();
  });

  it("shows KeyRevealDialog after create with the key and QR image", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const newBtn = await screen.findByRole("button", { name: /new beacon/i });
    await user.click(newBtn);
    await user.type(await screen.findByLabelText(/^name$/i), "Backup phone");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    // The reveal dialog appears.
    const key = await screen.findByLabelText(/^key$/i);
    expect(key).toHaveValue(`wbk_${"a".repeat(43)}`);
    const img = await screen.findByAltText(/enrolment qr code/i);
    expect(img).toHaveAttribute("src", "data:image/png;base64,AAAA");
    // The single close button is the only action.
    expect(
      screen.getByRole("button", { name: /i have stored the key/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).toBeNull();
  });

  it("rotate on an active beacon while an event is live warns about fan-out", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
    const row = screen.getByTestId(`beacon-row-${f.beacons[0]!.id}`);
    await user.click(within(row).getByRole("button", { name: /^rotate$/i }));
    // Confirm dialog opens with the fan-out sentence.
    expect(
      await screen.findByText(
        /location fan-out stops until this phone is re-enrolled/i
      )
    ).toBeInTheDocument();
  });

  it("captures the create body with the chosen role", async () => {
    const user = userEvent.setup();
    const captured: Array<{ name: string; notes: string; role: string }> = [];
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/beacons`,
        async ({ request }) => {
          const body = (await request.json()) as {
            name: string;
            notes: string;
            role: string;
          };
          captured.push(body);
          return HttpResponse.json(
            {
              beacon: f.beacons[0],
              key: "wbk_" + "z".repeat(43),
              enrollment: {
                token: "wet_" + "z".repeat(43),
                url: "https://api.example/enroll",
                qrPngDataUrl: "data:image/png;base64,ZZZZ",
                expiresAt: "2026-12-22T02:00:00.000Z",
              },
            },
            { status: 201 }
          );
        }
      )
    );
    render(<Harness />);
    const newBtn = await screen.findByRole("button", { name: /new beacon/i });
    await user.click(newBtn);
    await user.type(await screen.findByLabelText(/^name$/i), "Debug phone");
    await user.click(screen.getByRole("radio", { name: /admin/i }));
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]?.name).toBe("Debug phone");
    expect(captured[0]?.role).toBe("admin");
  });
});
