import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import AuditHistoryDialog from "./AuditHistoryDialog";
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
          <MemoryRouter>{children}</MemoryRouter>
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

describe("AuditHistoryDialog (admin.md 1)", () => {
  it("fetches entries for the given entity and id, newest first, and shows the changed fields summary", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/audit`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("entity")).toBe("sponsor");
        expect(url.searchParams.get("entityId")).toBe("4");
        return HttpResponse.json({
          items: [
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
          ],
          nextCursor: null,
        });
      })
    );

    render(
      <Harness>
        <AuditHistoryDialog
          open
          entity="sponsor"
          entityId="4"
          title="Example Bakery"
          onClose={() => undefined}
        />
      </Harness>
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/example bakery/i)).toBeInTheDocument();
    await within(dialog).findByText(/update/i);
    expect(
      within(dialog).getByText(/name: old bakery → example bakery/i)
    ).toBeInTheDocument();
    // Actor without the person: prefix.
    expect(within(dialog).getByText("editor@example.com")).toBeInTheDocument();
  });

  it("expands to show the raw before and after JSON", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/audit`, () =>
        HttpResponse.json({
          items: [
            {
              id: 900,
              at: "2026-12-22T01:31:07.412Z",
              actor: "person:me@example.com",
              action: "update",
              entity: "sponsor",
              entityId: "4",
              before: { unique_before: 111 },
              after: { unique_after: 222 },
              requestId: null,
            },
          ],
          nextCursor: null,
        })
      )
    );
    render(
      <Harness>
        <AuditHistoryDialog
          open
          entity="sponsor"
          entityId="4"
          title="Example Bakery"
          onClose={() => undefined}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/unique_before/i);
    await user.click(
      within(dialog).getByRole("button", { name: /show raw json/i })
    );
    await waitFor(() => {
      expect(within(dialog).getAllByText(/unique_after/i).length).toBeGreaterThan(0);
    });
  });

  it("Load more calls the endpoint with the returned cursor", async () => {
    const user = userEvent.setup();
    const cursors: (string | null)[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/audit`, ({ request }) => {
        const url = new URL(request.url);
        cursors.push(url.searchParams.get("cursor"));
        if (cursors.length === 1) {
          return HttpResponse.json({
            items: [
              {
                id: 900,
                at: "2026-12-22T01:31:07.412Z",
                actor: "person:me@example.com",
                action: "update",
                entity: "sponsor",
                entityId: "4",
                before: { a: 1 },
                after: { a: 2 },
                requestId: null,
              },
            ],
            nextCursor: "cursor-next",
          });
        }
        return HttpResponse.json({
          items: [
            {
              id: 899,
              at: "2026-12-22T01:00:00.000Z",
              actor: "person:me@example.com",
              action: "create",
              entity: "sponsor",
              entityId: "4",
              before: null,
              after: { a: 1 },
              requestId: null,
            },
          ],
          nextCursor: null,
        });
      })
    );

    render(
      <Harness>
        <AuditHistoryDialog
          open
          entity="sponsor"
          entityId="4"
          title="Example Bakery"
          onClose={() => undefined}
        />
      </Harness>
    );
    await screen.findByText(/a: 1 → 2/);
    const loadMore = await screen.findByRole("button", { name: /load more/i });
    await user.click(loadMore);
    await waitFor(() => expect(cursors[1]).toBe("cursor-next"));
    expect(await screen.findByText(/create/i)).toBeInTheDocument();
  });
});
