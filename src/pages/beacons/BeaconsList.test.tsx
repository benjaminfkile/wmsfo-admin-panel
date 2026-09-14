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
import type { Beacon } from "../../api/types";
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

// jsdom does not implement `window.matchMedia`; stubbing it to match
// lets `useCompact` return true and the list renders its cards.
function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  return () => {
    if (original === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).matchMedia;
    } else {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: original,
      });
    }
  };
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
  it("renders one row per beacon with name and key prefix (no role column)", async () => {
    render(<Harness />);
    await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
    const row = screen.getByTestId(`beacon-row-${f.beacons[0]!.id}`);
    expect(within(row).getByText(f.beacons[0]!.name!)).toBeInTheDocument();
    expect(
      within(row).getByText(f.beacons[0]!.keyPrefix!)
    ).toBeInTheDocument();
    // No role column header.
    expect(screen.queryByRole("columnheader", { name: /^role$/i })).toBeNull();
    // Healthy and hub headers are present.
    expect(
      screen.getByRole("columnheader", { name: /^healthy$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /^hub$/i })
    ).toBeInTheDocument();
  });

  it("shows the Active and Healthy chip on the active beacon", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
    expect(within(row).getByText("Active")).toBeInTheDocument();
    expect(within(row).getByText("Healthy")).toBeInTheDocument();
  });

  it("opens the create dialog with the new text and no role radio", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const newBtn = await screen.findByRole("button", { name: /new beacon/i });
    await user.click(newBtn);
    expect(
      await screen.findByText(/A beacon is a key/i)
    ).toBeInTheDocument();
    expect(await screen.findByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByText(/role cannot be changed later/i)).toBeNull();
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
    const row = await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
    // Open the row menu, then click Rotate.
    await user.click(
      within(row).getByRole("button", { name: /actions for/i })
    );
    await user.click(await screen.findByRole("menuitem", { name: /^rotate$/i }));
    // Confirm dialog opens with the fan-out sentence.
    expect(
      await screen.findByText(
        /location fan-out stops until this phone is re-enrolled/i
      )
    ).toBeInTheDocument();
  });

  it("sends only {name, notes} on create (no role field)", async () => {
    const user = userEvent.setup();
    const captured: Array<Record<string, unknown>> = [];
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/beacons`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
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
    await user.type(await screen.findByLabelText(/^name$/i), "Backup phone");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]).toEqual({ name: "Backup phone", notes: "" });
    expect(captured[0]).not.toHaveProperty("role");
  });

  it("has an edit pencil that links to the beacon page", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
    const pencil = within(row).getByRole("link", {
      name: new RegExp(`edit ${f.beacons[0]!.name}`, "i"),
    });
    expect(pencil).toHaveAttribute("href", `/beacons/${f.beacons[0]!.id}`);
  });

  describe("revoked beacons (admin.md 6.5)", () => {
    const makeRevoked = (
      id: number,
      name: string,
      keyPrefix: string
    ): Beacon => ({
      id,
      name,
      keyPrefix,
      isActive: false,
      revokedAt: "2026-12-20T00:00:00.000Z",
      lastSeenAt: null,
      lastLocationAt: null,
      lastHeartbeatAt: null,
      staleSince: null,
      telemetry: null,
      hubConnected: null,
      healthy: false,
      createdBy: "editor@example.com",
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-12-20T00:00:00.000Z",
    });

    const useSplitFixture = (): {
      active: Beacon[];
      revoked: Beacon[];
    } => {
      const active = [f.beacons[0]!];
      const revoked = [
        makeRevoked(101, "e2e-A", "wbk_e2eaaaaaa"),
        makeRevoked(102, "e2e-B", "wbk_e2ebbbbbb"),
        makeRevoked(103, "e2e-C", "wbk_e2eccccc0"),
        makeRevoked(104, "e2e-D", "wbk_e2edddddd"),
      ];
      server.use(
        http.get(`${testConfig.apiBaseUrl}/admin/beacons`, () =>
          HttpResponse.json({
            items: [...active, ...revoked],
            staleAfterS: 45,
          })
        )
      );
      return { active, revoked };
    };

    it("splits revoked rows out of the main table", async () => {
      const { active, revoked } = useSplitFixture();
      render(<Harness />);
      // Main table only has the one active beacon.
      await screen.findByTestId(`beacon-row-${active[0]!.id}`);
      // Revoked beacon rows are not visible in the main body (accordion is
      // collapsed by default, so their contents are hidden).
      const table = screen.getAllByRole("table")[0]!;
      const activeRows = within(table).getAllByRole("row");
      // 1 header row + 1 active row = 2 rows visible in the main table.
      expect(activeRows).toHaveLength(2);
      for (const r of revoked) {
        // Even if the DOM node exists (Collapse keeps it), it must not be
        // inside the main table.
        expect(within(table).queryByText(r.name!)).toBeNull();
      }
    });

    it("shows the count in the accordion header", async () => {
      useSplitFixture();
      render(<Harness />);
      await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
      const header = await screen.findByText(/^revoked \(4\)$/i);
      expect(header).toBeInTheDocument();
    });

    it("lists every revoked beacon inside the accordion, greyed, pencil-only", async () => {
      const user = userEvent.setup();
      const { revoked } = useSplitFixture();
      render(<Harness />);
      const accordion = await screen.findByTestId("revoked-beacons-accordion");
      // Expand.
      await user.click(within(accordion).getByRole("button", { name: /revoked/i }));
      for (const b of revoked) {
        const row = await within(accordion).findByTestId(`beacon-row-${b.id}`);
        expect(within(row).getByText(b.name!)).toBeInTheDocument();
        expect(within(row).getByText("Revoked")).toBeInTheDocument();
        // Greyed: the row's sx sets opacity 0.5.
        expect(row).toHaveStyle({ opacity: "0.5" });
        // Only the pencil: an edit link, no "Actions for" menu button.
        expect(
          within(row).getByRole("link", {
            name: new RegExp(`edit ${b.name!}`, "i"),
          })
        ).toBeInTheDocument();
        expect(
          within(row).queryByRole("button", { name: /actions for/i })
        ).toBeNull();
      }
    });

    it("does not render the accordion when there are no revoked beacons", async () => {
      render(<Harness />);
      await screen.findByTestId(`beacon-row-${f.beacons[0]!.id}`);
      expect(screen.queryByTestId("revoked-beacons-accordion")).toBeNull();
      expect(screen.queryByText(/^revoked \(/i)).toBeNull();
    });
  });

  describe("compact (M36)", () => {
    it("renders a card per active beacon with the flags and the menu", async () => {
      const restore = stubMatchMedia(true);
      try {
        render(<Harness />);
        for (const b of f.beacons.filter((x) => !x.revokedAt)) {
          const card = await screen.findByTestId(`beacon-row-${b.id}`);
          expect(
            within(card).getByRole("link", {
              name: new RegExp(`edit ${b.name}`, "i"),
            })
          ).toBeInTheDocument();
          expect(
            within(card).getByRole("button", {
              name: new RegExp(`actions for ${b.name}`, "i"),
            })
          ).toBeInTheDocument();
        }
        expect(screen.queryByRole("table")).toBeNull();
      } finally {
        restore();
      }
    });

    it("renders a card per revoked beacon on compact, greyed and pencil-only", async () => {
      const user = userEvent.setup();
      const restore = stubMatchMedia(true);
      const revoked = [
        {
          id: 201,
          name: "compact-A",
          keyPrefix: "wbk_ca______",
          isActive: false,
          revokedAt: "2026-12-20T00:00:00.000Z",
          lastSeenAt: null,
          lastLocationAt: null,
          lastHeartbeatAt: null,
          staleSince: null,
          telemetry: null,
          hubConnected: null,
          healthy: false,
          createdBy: "editor@example.com",
          createdAt: "2026-11-01T00:00:00.000Z",
          updatedAt: "2026-12-20T00:00:00.000Z",
        } as Beacon,
      ];
      server.use(
        http.get(`${testConfig.apiBaseUrl}/admin/beacons`, () =>
          HttpResponse.json({
            items: [f.beacons[0]!, ...revoked],
            staleAfterS: 45,
          })
        )
      );
      try {
        render(<Harness />);
        const accordion = await screen.findByTestId(
          "revoked-beacons-accordion"
        );
        await user.click(
          within(accordion).getByRole("button", { name: /revoked/i })
        );
        for (const b of revoked) {
          const card = await within(accordion).findByTestId(
            `beacon-row-${b.id}`
          );
          expect(within(card).getByText("Revoked")).toBeInTheDocument();
          expect(card).toHaveStyle({ opacity: "0.5" });
          expect(
            within(card).getByRole("link", {
              name: new RegExp(`edit ${b.name!}`, "i"),
            })
          ).toBeInTheDocument();
          expect(
            within(card).queryByRole("button", { name: /actions for/i })
          ).toBeNull();
        }
        expect(screen.queryByRole("table")).toBeNull();
      } finally {
        restore();
      }
    });
  });
});
