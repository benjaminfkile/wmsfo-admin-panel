// admin.md 8.3, 9.2: DeleteDialog fetches /admin/<resource>/{id}/impact
// on open and renders the warnings, "Also deleted", and "Unlinked"
// groups from fixtures; caps names at ten; keeps the confirm disabled
// until the impact has loaded; renders the general replacement select
// (required for a page holding a role, optional and shown only with
// unlinks for maps and themes); when `blocked` is set shows the
// sentence and Close only.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import DeleteDialog from "./DeleteDialog";
import { installClient } from "../api/client";
import { server } from "../test/msw/server";
import { buildTheme } from "../theme/theme";
import { NotifyProvider } from "../hooks/useNotify";
import { ConfigProvider } from "../ConfigContext";
import type { DeleteImpact } from "../api/impact";
import type { PageAdmin } from "../api/types";
import { pages as pagesApi } from "../api/resources/pages";
import { pageRoleReplacement } from "../pages/pages/pageRoleReplacement";
import * as f from "../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../test/renderWithProviders";

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
          <MemoryRouter>
            <NotifyProvider>{children}</NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

function useImpact(impact: DeleteImpact) {
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/places/:id/impact`, () =>
      HttpResponse.json(impact)
    )
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

describe("DeleteDialog", () => {
  it("keeps confirm disabled until the impact has loaded, then enables it", async () => {
    let resolveImpact!: (v: DeleteImpact) => void;
    const pending = new Promise<DeleteImpact>((r) => {
      resolveImpact = r;
    });
    server.use(
      http.get(
        `${testConfig.apiBaseUrl}/admin/places/:id/impact`,
        async () => HttpResponse.json(await pending)
      )
    );
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="Southgate"
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    // Before loading, the Delete button is disabled.
    const btn = within(dialog).getByRole("button", { name: /^delete$/i });
    expect(btn).toBeDisabled();
    resolveImpact({ blocked: null, deletes: [], unlinks: [], warnings: [] });
    await waitFor(() => expect(btn).toBeEnabled());
  });

  it("renders the Also deleted and Unlinked groups with names", async () => {
    useImpact({
      blocked: null,
      deletes: [
        {
          entity: "event_message",
          count: 3,
          names: ["Doors open", "Lift-off", "Landing"],
        },
        { entity: "cookie", count: 12, names: [] },
      ],
      unlinks: [
        {
          entity: "event",
          count: 2,
          names: ["2024 flight", "2025 flight"],
        },
      ],
      warnings: [],
    });
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="Southgate"
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    // Deletes group: message list and cookie count.
    await within(dialog).findByText(/also deleted/i);
    expect(
      within(dialog).getByText(/3 messages: Doors open, Lift-off, Landing/i)
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/^12 cookies$/i)).toBeInTheDocument();
    // Unlinks group: two events.
    expect(within(dialog).getByText(/unlinked/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/2 events lose their reference: 2024 flight, 2025 flight/i)
    ).toBeInTheDocument();
  });

  it("caps names at ten and shows a `+N more` suffix", async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `msg-${i + 1}`);
    useImpact({
      blocked: null,
      deletes: [{ entity: "event_message", count: 11, names: eleven }],
      unlinks: [],
      warnings: [],
    });
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="Southgate"
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    const line = await within(dialog).findByText(/11 messages:/);
    expect(line.textContent).toContain("msg-10");
    expect(line.textContent).not.toContain("msg-11");
    expect(line.textContent).toMatch(/\+1 more/);
  });

  it("shows the warnings as an alert above the groups", async () => {
    useImpact({
      blocked: null,
      deletes: [],
      unlinks: [],
      warnings: ["This beacon is active."],
    });
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="Southgate"
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(/this beacon is active/i);
  });

  it("shows Nothing else is affected when both groups are empty", async () => {
    useImpact({ blocked: null, deletes: [], unlinks: [], warnings: [] });
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="Southgate"
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText(/nothing else is affected/i)
    ).toBeInTheDocument();
  });

  it("shows the blocked sentence and only a Close button", async () => {
    useImpact({
      blocked: "This event is live. End it first.",
      deletes: [],
      unlinks: [],
      warnings: [],
    });
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="Santa Flyover 2026"
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/this event is live/i);
    // Close is the only button in the actions area; no Delete.
    expect(
      within(dialog).getByRole("button", { name: /close/i })
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /^delete$/i })
    ).toBeNull();
  });

  it("a required replacement gates Delete and hands the chosen id back as replacementId", async () => {
    useImpact({ blocked: null, deletes: [], unlinks: [], warnings: [] });
    const onConfirm = vi.fn();
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="Custom no-event page"
          replacement={{
            label: "Page that takes the No event role",
            candidates: [
              { id: 42, name: "Fallback page" },
              { id: 43, name: "Also OK" },
            ],
            required: true,
          }}
          onCancel={() => undefined}
          onConfirm={onConfirm}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    const btn = await within(dialog).findByRole("button", {
      name: /^delete$/i,
    });
    // A required select shows with no unlinks and keeps Delete disabled.
    const select = await within(dialog).findByRole("combobox", {
      name: /page that takes the no event role/i,
    });
    expect(btn).toBeDisabled();
    const user = userEvent.setup();
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: /fallback page/i }));
    await waitFor(() => expect(btn).toBeEnabled());
    await user.click(btn);
    expect(onConfirm).toHaveBeenCalledWith({ replacementId: 42 });
  });

  it("an optional replacement stays hidden without unlinks", async () => {
    useImpact({ blocked: null, deletes: [], unlinks: [], warnings: [] });
    const onConfirm = vi.fn();
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="West wing"
          replacement={{ label: "Replace with", candidates: [{ id: 2, name: "Other" }] }}
          onCancel={() => undefined}
          onConfirm={onConfirm}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/nothing else is affected/i);
    expect(
      within(dialog).queryByRole("combobox", { name: /replace with/i })
    ).toBeNull();
    const btn = within(dialog).getByRole("button", { name: /^delete$/i });
    expect(btn).toBeEnabled();
    await userEvent.setup().click(btn);
    expect(onConfirm).toHaveBeenCalledWith({ replacementId: null });
  });

  it("an optional replacement shows with unlinks, never gates Delete, and hands back null when untouched", async () => {
    useImpact({
      blocked: null,
      deletes: [],
      unlinks: [{ entity: "event", count: 1, names: ["2026 flight"] }],
      warnings: [],
    });
    const onConfirm = vi.fn();
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="West wing"
          replacement={{
            label: "Replace with",
            candidates: [
              { id: 2, name: "Other" },
              { id: 3, name: "Third" },
            ],
          }}
          onCancel={() => undefined}
          onConfirm={onConfirm}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    const select = await within(dialog).findByRole("combobox", {
      name: /replace with/i,
    });
    const btn = within(dialog).getByRole("button", { name: /^delete$/i });
    expect(btn).toBeEnabled();
    const user = userEvent.setup();
    await user.click(btn);
    expect(onConfirm).toHaveBeenLastCalledWith({ replacementId: null });

    await user.click(select);
    await user.click(await screen.findByRole("option", { name: "Third" }));
    await user.click(btn);
    expect(onConfirm).toHaveBeenLastCalledWith({ replacementId: 3 });
  });

  it("shows a failed confirm in the dialog's alert", async () => {
    useImpact({ blocked: null, deletes: [], unlinks: [], warnings: [] });
    render(
      <Harness>
        <DeleteDialog
          open
          resource="places"
          id={1}
          name="West wing"
          error={new Error("Something went wrong")}
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/nothing else is affected/i);
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();
  });

  it("the pages list hands a role page's takeover through the required replacement and sends it as roleTo", async () => {
    const pages = f.pageAdmin as PageAdmin[];
    const rolePage = pages.find((p) => p.role === "no_event")!;
    const replacement = pageRoleReplacement(rolePage, pages)!;
    expect(replacement.required).toBe(true);
    expect(replacement.label).toBe("Page that takes the No event role");
    expect(replacement.candidates.length).toBeGreaterThan(0);
    expect(
      replacement.candidates.every((c) => {
        const p = pages.find((x) => Number(x.id) === c.id);
        return p?.role === "none";
      })
    ).toBe(true);
    const contentPage = pages.find((p) => p.role === "none")!;
    expect(pageRoleReplacement(contentPage, pages)).toBeNull();

    const target = replacement.candidates[0]!;
    let deletedUrl: string | null = null;
    server.use(
      http.delete(`${testConfig.apiBaseUrl}/admin/pages/:id`, ({ request }) => {
        deletedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(
      <Harness>
        <PageDeleteProbe page={rolePage} pages={pages} />
      </Harness>
    );
    const dialog = await screen.findByRole("dialog");
    const btn = await within(dialog).findByRole("button", { name: /^delete$/i });
    const select = await within(dialog).findByRole("combobox", {
      name: /page that takes the no event role/i,
    });
    expect(btn).toBeDisabled();
    const user = userEvent.setup();
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: target.name }));
    await waitFor(() => expect(btn).toBeEnabled());
    await user.click(btn);
    await waitFor(() => expect(deletedUrl).not.toBeNull());
    const url = new URL(deletedUrl!);
    expect(url.pathname).toBe(`/admin/pages/${String(rolePage.id)}`);
    expect(url.searchParams.get("roleTo")).toBe(String(target.id));
  });
});

// The pages list's delete wiring: the role page's replacement in, the
// chosen id out to `pages.remove` as `roleTo`.
function PageDeleteProbe({ page, pages }: { page: PageAdmin; pages: PageAdmin[] }) {
  return (
    <DeleteDialog
      open
      resource="pages"
      id={Number(page.id)}
      name={page.title ?? "page"}
      replacement={pageRoleReplacement(page, pages)}
      onCancel={() => undefined}
      onConfirm={({ replacementId }) =>
        void pagesApi.remove(Number(page.id), replacementId)
      }
    />
  );
}
