// admin.md 6.22 Audit: filters, Deletes chip, links back to rows that
// still exist. Deleted rows are readable here and nowhere else.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import AuditPage from "./AuditPage";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

function Harness({ children }: { children: React.ReactNode }) {
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
          <MemoryRouter initialEntries={["/audit"]}>{children}</MemoryRouter>
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

describe("AuditPage on compact", () => {
  it("renders a card per entry with the expand toggle", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(
        <Harness>
          <AuditPage />
        </Harness>
      );
      const card = await screen.findByTestId("audit-page-row-900");
      expect(
        within(card).getByRole("button", { name: /show raw json/i })
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
    } finally {
      restore();
    }
  });
});

describe("AuditPage (admin.md 6.22)", () => {
  it("renders the entries newest first with the changed-fields summary", async () => {
    render(
      <Harness>
        <AuditPage />
      </Harness>
    );
    await screen.findByText(/name: old bakery → example bakery/i);
    // A delete entry from the fixtures is also listed.
    expect(
      screen.getByText(/name: snickerdoodle/i, { exact: false })
    ).toBeInTheDocument();
  });

  it("Deletes chip sets action=delete and filters the list", async () => {
    const user = userEvent.setup();
    const seenAction: string[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/audit`, ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        if (action) seenAction.push(action);
        const items = [
          {
            id: 898,
            at: "2026-12-21T21:00:00.000Z",
            actor: "person:editor@example.com",
            action: "delete",
            entity: "cookie_type",
            entityId: "42",
            before: { name: "Snickerdoodle" },
            after: null,
            requestId: "req-898",
          },
          {
            id: 900,
            at: "2026-12-22T01:31:07.412Z",
            actor: "person:editor@example.com",
            action: "update",
            entity: "sponsor",
            entityId: "4",
            before: { name: "Old Bakery" },
            after: { name: "Example Bakery" },
            requestId: "req-900",
          },
        ];
        if (action === "delete") {
          return HttpResponse.json({
            items: items.filter((i) => i.action === "delete"),
            nextCursor: null,
          });
        }
        return HttpResponse.json({ items, nextCursor: null });
      })
    );

    render(
      <Harness>
        <AuditPage />
      </Harness>
    );

    await screen.findByText(/name: old bakery → example bakery/i);
    // Click Deletes chip.
    await user.click(screen.getByText("Deletes"));
    await waitFor(() => expect(seenAction).toContain("delete"));
    // The update row disappears, the delete row (Snickerdoodle) remains.
    await waitFor(() => {
      expect(
        screen.queryByText(/name: old bakery → example bakery/i)
      ).toBeNull();
    });
    expect(
      screen.getByText(/name: snickerdoodle/i, { exact: false })
    ).toBeInTheDocument();
  });

  it("shows a link back to a live row's page and plain text on a deleted row", async () => {
    render(
      <Harness>
        <AuditPage />
      </Harness>
    );
    // The sponsor update row has entity `sponsor` and entityId `4` in
    // the fixtures, so it should link to /sponsors/4. Multiple sponsor
    // entries share that id in the fixtures, so at least one link with
    // that href should be present.
    const links = await screen.findAllByRole("link", { name: /sponsor #4/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]!.getAttribute("href")).toBe("/sponsors/4");
    // The delete row's entity link is rendered as plain text, not a link.
    const deletedLabel = screen.getByText(/cookie_type #42/i);
    expect(deletedLabel.tagName.toLowerCase()).toBe("span");
  });

  it("Entity filter drop-down mounts the entities returned by /admin/audit/entities", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <AuditPage />
      </Harness>
    );
    await screen.findByText(/name: old bakery → example bakery/i);
    // Open the entity select.
    const entity = screen.getByLabelText(/entity/i);
    await user.click(entity);
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "sponsor" })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "cookie_type" })).toBeInTheDocument();
  });
});
