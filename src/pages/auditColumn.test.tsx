// admin.md 1 "Audit column": every table of an audited resource ends
// with a column headed `Audit`, the last <td> of every row, holding
// one icon button labelled `Audit <name>`.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EventsList from "./events/EventsList";
import BeaconsList from "./beacons/BeaconsList";
import RoutesList from "./routes/RoutesList";
import SponsorsList from "./sponsors/SponsorsList";
import CookieTypesList from "./cookieTypes/CookieTypesList";
import ApiKeysList from "./apiKeys/ApiKeysList";
import PagesList from "./pages/PagesList";
import People from "./people/People";
import Subscribers from "./subscribers/Subscribers";
import ContactMessages from "./contact/ContactMessages";
import Settings from "./settings/Settings";
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
  auditableIds: (string | number)[];
  auditHeader?: RegExp;
}

const CASES: Case[] = [
  {
    name: "EventsList",
    Component: () => <EventsList />,
    rowTestId: (id) => `event-row-${id}`,
    auditableIds: f.events.map((e) => e.id!),
  },
  {
    name: "BeaconsList",
    Component: () => <BeaconsList />,
    rowTestId: (id) => `beacon-row-${id}`,
    auditableIds: f.beacons.map((b) => b.id!),
  },
  {
    name: "RoutesList",
    Component: () => <RoutesList />,
    rowTestId: (id) => `route-row-${id}`,
    auditableIds: f.routes.map((r) => r.id!),
  },
  {
    name: "SponsorsList",
    Component: () => <SponsorsList />,
    rowTestId: (id) => `sponsor-row-${id}`,
    auditableIds: f.sponsors.map((s) => s.id!),
  },
  {
    name: "CookieTypesList",
    Component: () => <CookieTypesList />,
    rowTestId: (id) => `cookie-type-row-${id}`,
    auditableIds: f.cookieTypes.map((c) => c.id!),
  },
  {
    name: "ApiKeysList",
    Component: () => <ApiKeysList />,
    rowTestId: (id) => `api-key-row-${id}`,
    auditableIds: f.apiKeys.map((k) => k.id!),
  },
  {
    name: "PagesList",
    Component: () => <PagesList />,
    rowTestId: (id) => `page-row-${id}`,
    auditableIds: f.pageAdmin.map((p) => p.id!),
  },
  {
    name: "People",
    Component: () => <People />,
    rowTestId: (id) => `person-row-${id}`,
    auditableIds: f.people.map((p) => p.id!),
  },
  {
    name: "Subscribers",
    Component: () => <Subscribers />,
    rowTestId: (id) => `subscriber-row-${id}`,
    auditableIds: f.subscribers.map((s) => s.id!),
  },
  {
    name: "ContactMessages",
    Component: () => <ContactMessages />,
    rowTestId: (id) => `contact-row-${id}`,
    auditableIds: f.contactMessages.map((m) => m.id!),
  },
  {
    name: "Settings",
    Component: () => <Settings />,
    rowTestId: (id) => `setting-row-${id}`,
    auditableIds: f.settings.map((s) => s.key ?? ""),
  },
];

describe("Audit column (admin.md 1)", () => {
  it.each(CASES)(
    "$name renders an Audit icon in every audited row",
    async ({ Component, rowTestId, auditableIds }) => {
      render(
        <Harness>
          <Component />
        </Harness>
      );
      for (const id of auditableIds) {
        const row = await screen.findByTestId(rowTestId(id));
        const buttons = within(row).queryAllByRole("button", {
          name: /^audit /i,
        });
        expect(buttons.length).toBeGreaterThan(0);
      }
    }
  );

  it.each(CASES)(
    "$name's Audit column is the last <td> of every row",
    async ({ Component, rowTestId, auditableIds }) => {
      render(
        <Harness>
          <Component />
        </Harness>
      );
      for (const id of auditableIds) {
        const row = await screen.findByTestId(rowTestId(id));
        const cells = row.querySelectorAll("td");
        const last = cells[cells.length - 1];
        expect(last).toBeTruthy();
        const auditButton = last?.querySelector('button[aria-label^="Audit "]');
        expect(auditButton).not.toBeNull();
      }
    }
  );
});
