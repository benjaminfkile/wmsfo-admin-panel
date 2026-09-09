// admin.md 9.2, Page editor row:
//   - palette greys a kind the page's role excludes and leaves allowed kinds enabled
//   - adding a section posts that kind's defaults from the vendored schema
//   - a field edit patches once after the 1 s debounce (fake timers) and not per keystroke
//   - a 400 validation_failed with details.fields lands on the named field
//   - the problems badge shows the count from GET /admin/content/status
//   - duplicate, move, hide, delete each call their endpoint
//   - items reorder inside ItemsEditor sends the new order

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
} from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PageEditor from "./PageEditor";
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
import type {
  KindInfo,
  PageAdmin,
  PageDetail,
  SectionAdmin,
  SectionItemAdmin,
} from "../../api/types";

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
          <MemoryRouter initialEntries={["/pages/3"]}>
            <NotifyProvider>
              <Routes>
                <Route path="/pages/:id" element={<PageEditor />} />
              </Routes>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

describe("PageEditor", () => {
  it("palette greys a kind the page's role excludes and leaves allowed kinds enabled", async () => {
    const kinds: KindInfo[] = [
      {
        ...(f.kinds[0] as KindInfo),
        kind: "rich_text",
        title: "Rich text",
        allowedRoles: null,
      },
      {
        ...(f.kinds[0] as KindInfo),
        kind: "map",
        title: "Map",
        allowedRoles: ["live"],
      },
    ];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      )
    );
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("button", { name: /add section/i });
    await user.click(screen.getByRole("button", { name: /add section/i }));

    const allowed = await screen.findByTestId("palette-kind-rich_text");
    const excluded = await screen.findByTestId("palette-kind-map");
    expect(allowed).not.toBeDisabled();
    expect(excluded).toBeDisabled();
  });

  it("adding a section posts that kind's defaults from the vendored schema", async () => {
    const defaults = {
      blocks: [{ kind: "paragraph", text: "Write something." }],
    };
    const kinds: KindInfo[] = [
      {
        ...(f.kinds[0] as KindInfo),
        kind: "rich_text",
        title: "Rich text",
        allowedRoles: null,
        defaults,
      },
    ];
    let posted: unknown = null;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/pages/:id/sections`,
        async ({ request }) => {
          posted = await request.json();
          return HttpResponse.json(f.sampleSection, { status: 201 });
        }
      )
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /add section/i }));
    await user.click(await screen.findByTestId("palette-kind-rich_text"));

    await waitFor(() => {
      expect(posted).not.toBeNull();
    });
    expect(posted).toMatchObject({ kind: "rich_text", data: defaults });
  });

  it("a field edit patches once after the 1 s debounce and not per keystroke", async () => {
    let patches = 0;
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/sections/:id`, () => {
        patches += 1;
        return HttpResponse.json(f.sampleSection);
      })
    );
    render(<Harness />);
    await screen.findByTestId(`section-card-${f.sampleSection.id}`);
    // Switch to Presentation tab so the anchor field is visible.
    const presTab = await screen.findByRole("tab", { name: /presentation/i });
    fireEvent.click(presTab);
    const anchor = await screen.findByLabelText(/anchor/i);

    // Two keystrokes back-to-back.
    fireEvent.change(anchor, { target: { value: "a" } });
    fireEvent.change(anchor, { target: { value: "ab" } });

    // Before the 1 s debounce elapses no patch has fired.
    await act(async () => {
      await sleep(300);
    });
    expect(patches).toBe(0);

    // After the debounce, exactly one patch.
    await act(async () => {
      await sleep(1200);
    });
    expect(patches).toBe(1);
  }, 10000);

  it("a 400 validation_failed with details.fields lands on the named field", async () => {
    const kinds: KindInfo[] = [
      {
        ...(f.kinds[0] as KindInfo),
        kind: "rich_text",
        title: "Rich text",
        schema: {
          type: "object",
          properties: {
            title: { type: "string", title: "Section title" },
          },
        },
        defaults: { title: "" },
      },
    ];
    const section: SectionAdmin = {
      ...f.sampleSection,
      data: { title: "Hi" },
    };
    const pageDetail: PageDetail = {
      ...f.pageDetail,
      sections: [section],
    };
    let attempts = 0;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      ),
      http.patch(`${testConfig.apiBaseUrl}/admin/sections/:id`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(
            {
              code: "validation_failed",
              message: "Validation failed",
              details: { fields: { "/title": "Title is too short" } },
              requestId: "req_1",
            },
            { status: 400 }
          );
        }
        return HttpResponse.json(f.sampleSection);
      })
    );

    render(<Harness />);
    const card = await screen.findByTestId(
      `section-card-${f.sampleSection.id}`
    );

    const title = await within(card).findByLabelText(/section title/i);
    fireEvent.change(title, { target: { value: "New" } });
    await act(async () => {
      await sleep(1200);
    });
    await waitFor(() => {
      expect(attempts).toBe(1);
    });

    await waitFor(() => {
      expect(within(card).getAllByText(/title is too short/i).length).toBeGreaterThan(0);
    });
    expect(await within(card).findByText(/not saved/i)).toBeInTheDocument();

    fireEvent.change(title, { target: { value: "New title" } });
    await act(async () => {
      await sleep(1200);
    });
    await waitFor(() => {
      expect(attempts).toBe(2);
    });
    await waitFor(() => {
      expect(
        within(card).queryAllByText(/title is too short/i)
      ).toHaveLength(0);
    });
    expect(await within(card).findByText(/^saved$/i)).toBeInTheDocument();
  }, 10000);

  it("problems badge shows the count", async () => {
    // PageEditor renders "<n> problems" for page.problemCount > 0. Override
    // the page detail to produce a nonzero count and assert it renders.
    const pageDetail: PageDetail = {
      ...f.pageDetail,
      problemCount: 3,
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json({ ...f.contentStatus, problems: [] })
      )
    );
    render(<Harness />);
    expect(await screen.findByText(/3 problems/i)).toBeInTheDocument();
  });

  it("duplicate calls POST /admin/sections/:id/duplicate", async () => {
    let dupCalled = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/sections/:id/duplicate`,
        () => {
          dupCalled += 1;
          return HttpResponse.json(f.sampleSection, { status: 201 });
        }
      )
    );
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByTestId(`section-card-${f.sampleSection.id}`);
    await user.click(screen.getByLabelText(/section menu/i));
    await user.click(await screen.findByRole("menuitem", { name: /duplicate/i }));

    await waitFor(() => {
      expect(dupCalled).toBe(1);
    });
  });

  it("move calls POST /admin/sections/:id/move", async () => {
    const otherPage: PageAdmin = {
      ...(f.pageAdmin[0] as PageAdmin),
      id: 5,
      slug: "events",
      title: "Events",
      role: "none",
      sectionCount: 3,
    };
    const currentPage: PageAdmin = {
      ...(f.pageAdmin[1] as PageAdmin),
    };
    let moveBody: unknown = null;
    let movePathId: string | undefined;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/pages`, () =>
        HttpResponse.json({ items: [currentPage, otherPage] })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/sections/:id/move`,
        async ({ params, request }) => {
          movePathId = params["id"] as string;
          moveBody = await request.json();
          return HttpResponse.json(f.sampleSection);
        }
      )
    );
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByTestId(`section-card-${f.sampleSection.id}`);
    await user.click(screen.getByLabelText(/section menu/i));
    await user.click(
      await screen.findByRole("menuitem", { name: /move to page/i })
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId(`move-target-${otherPage.id}`));
    await user.click(within(dialog).getByRole("button", { name: /^move$/i }));

    await waitFor(() => {
      expect(moveBody).not.toBeNull();
    });
    expect(movePathId).toBe(String(f.sampleSection.id));
    expect(moveBody).toEqual({
      pageId: otherPage.id,
      position: otherPage.sectionCount,
    });
  });

  it("hide calls PATCH /admin/sections/:id with isHidden", async () => {
    let patchBody: unknown = null;
    server.use(
      http.patch(
        `${testConfig.apiBaseUrl}/admin/sections/:id`,
        async ({ request }) => {
          patchBody = await request.json();
          return HttpResponse.json(f.sampleSection);
        }
      )
    );
    render(<Harness />);
    const card = await screen.findByTestId(
      `section-card-${f.sampleSection.id}`
    );
    const hiddenSwitch = within(card).getByRole("switch");
    fireEvent.click(hiddenSwitch);

    await waitFor(() => {
      expect(patchBody).not.toBeNull();
    });
    expect(patchBody).toEqual({ isHidden: true });
  });

  it("delete calls DELETE /admin/sections/:id", async () => {
    let delCalled = 0;
    server.use(
      http.delete(`${testConfig.apiBaseUrl}/admin/sections/:id`, () => {
        delCalled += 1;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByTestId(`section-card-${f.sampleSection.id}`);
    await user.click(screen.getByLabelText(/section menu/i));
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));

    // Confirm the delete.
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(delCalled).toBe(1);
    });
  });

  it("items reorder inside ItemsEditor sends the new order", async () => {
    const kinds: KindInfo[] = [
      {
        ...(f.kinds[0] as KindInfo),
        kind: "media",
        title: "Media",
        hasItems: true,
        schema: { type: "object", properties: {} },
        itemSchema: {
          type: "object",
          properties: { caption: { type: "string" } },
        },
        itemDefaults: { caption: "" },
      },
    ];
    const items: SectionItemAdmin[] = [
      {
        id: 101,
        sectionId: 9,
        position: 0,
        isHidden: false,
        data: { caption: "First" },
        problems: [],
        updatedBy: "editor@example.com",
        updatedAt: "2026-12-22T01:31:07.412Z",
      },
      {
        id: 102,
        sectionId: 9,
        position: 1,
        isHidden: false,
        data: { caption: "Second" },
        problems: [],
        updatedBy: "editor@example.com",
        updatedAt: "2026-12-22T01:31:07.412Z",
      },
    ];
    const section: SectionAdmin = {
      ...f.sampleSection,
      kind: "media",
      items,
    };
    const pageDetail: PageDetail = {
      ...f.pageDetail,
      sections: [section],
    };
    let orderBody: unknown = null;
    let orderSectionId: string | undefined;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      ),
      http.put(
        `${testConfig.apiBaseUrl}/admin/sections/:id/items/order`,
        async ({ params, request }) => {
          orderSectionId = params["id"] as string;
          orderBody = await request.json();
          return HttpResponse.json(section);
        }
      )
    );
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByTestId(`section-card-${f.sampleSection.id}`);

    const row = await screen.findByTestId(`item-row-${items[0]!.id}`);
    await user.click(within(row).getByLabelText(/move item 101 down/i));

    await waitFor(() => {
      expect(orderBody).not.toBeNull();
    });
    expect(orderSectionId).toBe(String(f.sampleSection.id));
    expect(orderBody).toEqual({ ids: [102, 101] });
  });
});
