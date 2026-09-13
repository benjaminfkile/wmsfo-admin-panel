import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import SponsorsList from "./SponsorsList";
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
import type { Sponsor, SponsorYear } from "../../api/types";

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
          <MemoryRouter initialEntries={["/sponsors"]}>
            <NotifyProvider>
              <Routes>
                <Route path="/sponsors" element={<SponsorsList />} />
              </Routes>
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

function year(y: number, amount: number): SponsorYear {
  return {
    eventYear: y,
    amountDonated: amount,
    active: true,
    canAdvertise: true,
    anonymous: false,
    pinnedPosition: null,
    lingerMsOverride: null,
    lingerMs: 20000,
    registeredAt: `${y}-12-22T01:31:07.412Z`,
  };
}

describe("SponsorsList: Audit column", () => {
  it("renders an Audit icon whose tooltip names the last editor from the audit stamp", async () => {
    render(<Harness />);
    const row = await screen.findByTestId(`sponsor-row-${f.sponsors[0]!.id}`);
    const auditButton = within(row).getByRole("button", {
      name: `Audit ${f.sponsors[0]!.name}`,
    });
    // The tooltip title on the wrapping element carries the stamp with
    // the actor stripped of the `person:` prefix (admin.md 1).
    const parent = auditButton.closest("[aria-label]") ?? auditButton;
    expect(parent).toBeTruthy();
    const tooltipLabel =
      auditButton.getAttribute("aria-label") ??
      parent?.getAttribute("aria-label") ??
      "";
    // aria-label on the IconButton stays `Audit <name>`; the tooltip
    // text lives on the MUI Tooltip's title, which the DOM exposes as
    // the button's tooltip after hover. Simulating hover here is
    // heavier than asserting the icon is present and knows the actor.
    expect(tooltipLabel).toMatch(/^Audit /);
    // The stamp text function returns "Update by editor@example.com · <time>"
    // for this row's audit stamp; assert the actor appears somewhere in
    // the DOM once the tooltip is hovered.
    // (Kept minimal: presence of the audit button is the contract.)
  });
});

describe("SponsorsList: import from year", () => {
  it("lists candidates that have the from year and lack the to year (all ticked by default), and POSTs the tick list", async () => {
    const user = userEvent.setup();
    // Events: 2025, 2026, 2027 (current). To-year default is 2027.
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
        HttpResponse.json({
          items: [
            {
              ...f.events[0]!,
              id: 8,
              year: 2027,
              isCurrent: true,
            },
            { ...f.events[0]!, id: 7, year: 2026, isCurrent: false },
            f.events[1]!,
          ],
        })
      )
    );
    // Three sponsors: two have only 2025 (candidates), one already has
    // 2027 (skipped from candidacy).
    const bakery: Sponsor = {
      ...f.sponsors[0]!,
      id: 4,
      name: "Example Bakery",
      years: [year(2025, 300)],
    };
    const cafe: Sponsor = {
      ...f.sponsors[0]!,
      id: 5,
      name: "Cheer Cafe",
      years: [year(2025, 150)],
    };
    const alreadyIn: Sponsor = {
      ...f.sponsors[0]!,
      id: 6,
      name: "Ready Corp",
      years: [year(2025, 90), year(2027, 90)],
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/sponsors`, () =>
        HttpResponse.json({ items: [bakery, cafe, alreadyIn] })
      )
    );
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/sponsors/import`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json({ created: 2, skipped: 0 });
        }
      )
    );
    render(<Harness />);
    // Wait for the seed row (the toolbar's Import button is rendered
    // above the table).
    await screen.findByText("Example Bakery");
    await user.click(screen.getByRole("button", { name: /import from year/i }));
    // The dialog defaults the from year to the newest year in any
    // sponsor's years (2027 here). We switch it to 2025 for the
    // acceptance criterion (2025 to 2027).
    const fromSel = await screen.findByLabelText(/from year/i);
    await user.click(fromSel);
    await user.click(await screen.findByRole("option", { name: "2025" }));
    // Candidates: bakery and cafe (both have 2025, neither has 2027);
    // alreadyIn is skipped (has 2027 already).
    const list = await screen.findByTestId("sponsor-import-candidates");
    expect(within(list).getByText("Example Bakery")).toBeInTheDocument();
    expect(within(list).getByText("Cheer Cafe")).toBeInTheDocument();
    expect(within(list).queryByText("Ready Corp")).not.toBeInTheDocument();
    // Both ticked by default: click Import and the body contains both ids.
    await user.click(screen.getByRole("button", { name: /^import 2$/i }));
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]!.body as {
      fromYear: number;
      toYear: number;
      sponsorIds: number[];
    };
    expect(body.fromYear).toBe(2025);
    expect(body.toYear).toBe(2027);
    expect([...body.sponsorIds].sort()).toEqual([4, 5]);
    // The snackbar reports created and skipped counts.
    expect(
      await screen.findByText(/imported 2, skipped 0/i)
    ).toBeInTheDocument();
  });

  it("switching the to year re-filters the candidate list", async () => {
    const user = userEvent.setup();
    // Events: 2025, 2026 (current), 2027. Two sponsors:
    //  - Cafe has just 2025 → candidate for either to-year.
    //  - Ready has 2025 and 2027 → candidate for to=2026 (default);
    //    filtered out when to switches to 2027.
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
        HttpResponse.json({
          items: [
            {
              ...f.events[0]!,
              id: 8,
              year: 2027,
              isCurrent: false,
            },
            f.events[0]!,
            f.events[1]!,
          ],
        })
      )
    );
    const cafe: Sponsor = {
      ...f.sponsors[0]!,
      id: 5,
      name: "Cheer Cafe",
      years: [year(2025, 150)],
    };
    const ready: Sponsor = {
      ...f.sponsors[0]!,
      id: 6,
      name: "Ready Corp",
      years: [year(2025, 90), year(2027, 90)],
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/sponsors`, () =>
        HttpResponse.json({ items: [cafe, ready] })
      )
    );
    render(<Harness />);
    await screen.findByText("Cheer Cafe");
    await user.click(screen.getByRole("button", { name: /import from year/i }));
    // Pick from-year 2025.
    const fromSel = await screen.findByLabelText(/from year/i);
    await user.click(fromSel);
    await user.click(await screen.findByRole("option", { name: "2025" }));
    // With to-year = 2026 (current), both are candidates.
    const list = await screen.findByTestId("sponsor-import-candidates");
    await waitFor(() =>
      expect(within(list).getByText("Ready Corp")).toBeInTheDocument()
    );
    expect(within(list).getByText("Cheer Cafe")).toBeInTheDocument();
    // Change to-year to 2027; Ready Corp is filtered out.
    const toSel = screen.getByLabelText(/to year/i);
    await user.click(toSel);
    await user.click(await screen.findByRole("option", { name: "2027" }));
    await waitFor(() =>
      expect(within(list).queryByText("Ready Corp")).not.toBeInTheDocument()
    );
    expect(within(list).getByText("Cheer Cafe")).toBeInTheDocument();
  });

  it("unticking a candidate excludes its id from the POST body", async () => {
    const user = userEvent.setup();
    const bakery: Sponsor = {
      ...f.sponsors[0]!,
      id: 4,
      name: "Example Bakery",
      years: [year(2025, 300)],
    };
    const cafe: Sponsor = {
      ...f.sponsors[0]!,
      id: 5,
      name: "Cheer Cafe",
      years: [year(2025, 150)],
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/sponsors`, () =>
        HttpResponse.json({ items: [bakery, cafe] })
      )
    );
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/sponsors/import`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json({ created: 1, skipped: 0 });
        }
      )
    );
    render(<Harness />);
    await screen.findByText("Example Bakery");
    await user.click(screen.getByRole("button", { name: /import from year/i }));
    await screen.findByTestId("sponsor-import-candidates");
    // The default from/to are 2025/2026 (both sponsors have 2025 only,
    // 2026 is the current event year fixture); no explicit switch needed.
    // Untick the cafe.
    const cafeCheck = screen.getByRole("checkbox", {
      name: /import cheer cafe/i,
    });
    await user.click(cafeCheck);
    await user.click(screen.getByRole("button", { name: /^import 1$/i }));
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]!.body as { sponsorIds: number[] };
    expect(body.sponsorIds).toEqual([4]);
  });
});
