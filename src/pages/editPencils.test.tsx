// admin.md 1 "Edit controls": every editable row on every list page
// carries an edit pencil, and rows whose entity is not editable
// (flight recordings, API keys) do not.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EventsList from "./events/EventsList";
import BeaconsList from "./beacons/BeaconsList";
import SponsorsList from "./sponsors/SponsorsList";
import CookieTypesList from "./cookieTypes/CookieTypesList";
import PagesList from "./pages/PagesList";
import RoutesList from "./routes/RoutesList";
import ApiKeysList from "./apiKeys/ApiKeysList";
import { ConfigProvider } from "../ConfigContext";
import { NotifyProvider } from "../hooks/useNotify";
import { installClient } from "../api/client";
import { buildTheme } from "../theme/theme";
import { server } from "../test/msw/server";
import * as f from "../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../test/renderWithProviders";

function Harness({ children }: { children: ReactNode }) {
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
          <MemoryRouter initialEntries={["/"]}>
            <NotifyProvider>{children}</NotifyProvider>
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

interface Case {
  name: string;
  Component: () => ReactElement;
  rowTestId: (id: string | number) => string;
  editableIds: (string | number)[];
}

const EDITABLE: Case[] = [
  {
    name: "EventsList",
    Component: () => <EventsList />,
    rowTestId: (id) => `event-row-${id}`,
    editableIds: f.events.map((e) => e.id!),
  },
  {
    name: "BeaconsList",
    Component: () => <BeaconsList />,
    rowTestId: (id) => `beacon-row-${id}`,
    editableIds: f.beacons.map((b) => b.id!),
  },
  {
    name: "SponsorsList",
    Component: () => <SponsorsList />,
    rowTestId: (id) => `sponsor-row-${id}`,
    editableIds: f.sponsors.map((s) => s.id!),
  },
  {
    name: "CookieTypesList",
    Component: () => <CookieTypesList />,
    rowTestId: (id) => `cookie-type-row-${id}`,
    editableIds: f.cookieTypes.map((c) => c.id!),
  },
  {
    name: "PagesList",
    Component: () => <PagesList />,
    rowTestId: (id) => `page-row-${id}`,
    editableIds: f.pageAdmin.map((p) => p.id!),
  },
];

const EXCEPTIONS: Case[] = [
  {
    name: "RoutesList (flight recordings)",
    Component: () => <RoutesList />,
    rowTestId: (id) => `route-row-${id}`,
    editableIds: f.routes.map((r) => r.id!),
  },
  {
    name: "ApiKeysList",
    Component: () => <ApiKeysList />,
    rowTestId: (id) => `api-key-row-${id}`,
    editableIds: f.apiKeys.map((k) => k.id!),
  },
];

describe("edit pencils (admin.md 1)", () => {
  it.each(EDITABLE)(
    "$name renders an edit pencil per editable row",
    async ({ Component, rowTestId, editableIds }) => {
      render(<Harness><Component /></Harness>);
      for (const id of editableIds) {
        const row = await screen.findByTestId(rowTestId(id));
        // The pencil is either a link (navigates to editor) or a button
        // (opens a dialog); MUI's IconButton with component=RouterLink
        // renders an <a> so it appears under role=link.
        const links = within(row).queryAllByRole("link", {
          name: /^edit /i,
        });
        const buttons = within(row).queryAllByRole("button", {
          name: /^edit /i,
        });
        expect(links.length + buttons.length).toBeGreaterThan(0);
      }
    }
  );

  it.each(EXCEPTIONS)(
    "$name renders no edit pencil",
    async ({ Component, rowTestId, editableIds }) => {
      render(<Harness><Component /></Harness>);
      for (const id of editableIds) {
        const row = await screen.findByTestId(rowTestId(id));
        expect(
          within(row).queryByRole("link", { name: /^edit /i })
        ).toBeNull();
        expect(
          within(row).queryByRole("button", { name: /^edit /i })
        ).toBeNull();
      }
    }
  );
});
