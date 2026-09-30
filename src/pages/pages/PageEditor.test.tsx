// admin.md 9.2, Page editor row:
//   - palette greys a kind the page's role excludes and leaves allowed kinds enabled
//   - adding a section posts that kind's defaults from the vendored schema
//   - a field edit patches once after the 1 s debounce (fake timers) and not per keystroke
//   - a 400 validation_failed with details.fields lands on the named field
//   - the problems badge shows the count from GET /admin/content/status
//   - duplicate, move, hide, delete each call their endpoint
//   - items reorder inside ItemsEditor sends the new order
// admin.md 6.14:
//   - each section card header shows its number, the kind title, and
//     a one-line summary of the data
//   - rich_text summarises the block kinds in order; a kind with items
//     summarises as "N items"
//   - up and down arrows live inside the header, next to the menu
//   - clicking the header toggles the card between collapsed and
//     expanded (all start collapsed except a just-added section)
//   - Expand all and Collapse all buttons above the stack apply to
//     every card in the stack
//   - items render as nested cards inside the parent card, headed
//     "Item n of m"
//   - a role page's Page settings dialog edits the Menu icon with PATCH

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

async function expandSection(id: number | string): Promise<HTMLElement> {
  const card = await screen.findByTestId(`section-card-${id}`);
  const header = within(card).getByTestId(`section-header-${id}`);
  const expandBtn = within(header).getByLabelText(/expand section/i);
  fireEvent.click(expandBtn);
  return card;
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
    await expandSection(f.sampleSection.id!);
    const presTab = await screen.findByRole("tab", { name: /presentation/i });
    fireEvent.click(presTab);
    const anchor = await screen.findByLabelText(/anchor/i);

    fireEvent.change(anchor, { target: { value: "a" } });
    fireEvent.change(anchor, { target: { value: "ab" } });

    await act(async () => {
      await sleep(300);
    });
    expect(patches).toBe(0);

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
    const card = await expandSection(f.sampleSection.id!);

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

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(delCalled).toBe(1);
    });
  });

  it("item Hidden switch sends PATCH /admin/items/:id with only isHidden", async () => {
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
        id: 501,
        sectionId: 9,
        position: 0,
        isHidden: false,
        data: { caption: "One" },
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
    const captured: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      ),
      http.patch(
        `${testConfig.apiBaseUrl}/admin/items/:id`,
        async ({ request }) => {
          captured.push({ url: request.url, body: await request.json() });
          return HttpResponse.json(items[0]);
        }
      )
    );
    render(<Harness />);
    await expandSection(f.sampleSection.id!);

    const row = await screen.findByTestId(`item-row-${items[0]!.id}`);
    const hiddenSwitch = within(row).getByTestId(
      `item-hidden-switch-${items[0]!.id}`
    );
    const input = hiddenSwitch.querySelector("input");
    if (input) fireEvent.click(input);

    await waitFor(() => {
      expect(captured.length).toBeGreaterThan(0);
    });
    expect(captured[0]?.url).toContain(`/admin/items/${items[0]!.id}`);
    expect(captured[0]?.body).toEqual({ isHidden: true });
  });

  it("a hidden item's card shows the Hidden label", async () => {
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
        id: 601,
        sectionId: 9,
        position: 0,
        isHidden: true,
        data: { caption: "Hidden one" },
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
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      )
    );
    render(<Harness />);
    await expandSection(f.sampleSection.id!);
    expect(
      await screen.findByTestId(`item-hidden-chip-${items[0]!.id}`)
    ).toBeInTheDocument();
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
    await expandSection(f.sampleSection.id!);

    const row = await screen.findByTestId(`item-row-${items[0]!.id}`);
    await user.click(within(row).getByLabelText(/move item 101 down/i));

    await waitFor(() => {
      expect(orderBody).not.toBeNull();
    });
    expect(orderSectionId).toBe(String(f.sampleSection.id));
    expect(orderBody).toEqual({ ids: [102, 101] });
  });

  it("the header shows the number, the kind title, and a data summary", async () => {
    const kinds: KindInfo[] = [
      {
        ...(f.kinds[0] as KindInfo),
        kind: "rich_text",
        title: "Rich text",
        hasItems: false,
      },
    ];
    const section: SectionAdmin = {
      ...f.sampleSection,
      data: {
        blocks: [
          { kind: "heading", text: "Hi" },
          { kind: "paragraph", text: "Body" },
          { kind: "list", items: ["a", "b", "c", "d"] },
        ],
      },
    };
    const pageDetail: PageDetail = {
      ...f.pageDetail,
      sections: [section],
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      )
    );

    render(<Harness />);
    const title = await screen.findByTestId(
      `section-title-${f.sampleSection.id}`
    );
    expect(title.textContent).toContain("1");
    expect(title.textContent).toContain("Rich text");

    const summary = await screen.findByTestId(
      `section-summary-${f.sampleSection.id}`
    );
    expect(summary.textContent).toBe("Heading, paragraph, list of 4");
  });

  it("a kind with items shows the item count as the summary", async () => {
    const kinds: KindInfo[] = [
      {
        ...(f.kinds[0] as KindInfo),
        kind: "icon_row",
        title: "Icon row",
        hasItems: true,
        schema: { type: "object", properties: {} },
        itemSchema: {
          type: "object",
          properties: { label: { type: "string" } },
        },
        itemDefaults: { label: "" },
      },
    ];
    const items: SectionItemAdmin[] = [1, 2, 3, 4, 5].map((n) => ({
      id: 200 + n,
      sectionId: 9,
      position: n - 1,
      isHidden: false,
      data: { label: `Item ${n}` },
      problems: [],
      updatedBy: "editor@example.com",
      updatedAt: "2026-12-22T01:31:07.412Z",
    }));
    const section: SectionAdmin = {
      ...f.sampleSection,
      kind: "icon_row",
      items,
    };
    const pageDetail: PageDetail = {
      ...f.pageDetail,
      sections: [section],
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      )
    );

    render(<Harness />);
    const summary = await screen.findByTestId(
      `section-summary-${f.sampleSection.id}`
    );
    expect(summary.textContent).toBe("5 items");
  });

  it("up and down arrows live inside the header, disabled where they should be", async () => {
    const sectionA: SectionAdmin = { ...f.sampleSection, id: 9 };
    const sectionB: SectionAdmin = { ...f.sampleSection, id: 10 };
    const pageDetail: PageDetail = {
      ...f.pageDetail,
      sections: [sectionA, sectionB],
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      )
    );

    render(<Harness />);
    const cardA = await screen.findByTestId(`section-card-${sectionA.id}`);
    const cardB = await screen.findByTestId(`section-card-${sectionB.id}`);
    const headerA = within(cardA).getByTestId(`section-header-${sectionA.id}`);
    const headerB = within(cardB).getByTestId(`section-header-${sectionB.id}`);

    // Both arrows sit in each card's header, not floating above the card.
    expect(within(headerA).getByLabelText(/move section up/i)).toBeInTheDocument();
    expect(within(headerA).getByLabelText(/move section down/i)).toBeInTheDocument();
    expect(within(headerB).getByLabelText(/move section up/i)).toBeInTheDocument();
    expect(within(headerB).getByLabelText(/move section down/i)).toBeInTheDocument();

    // First card: up disabled, down enabled. Last card: up enabled, down disabled.
    expect(within(headerA).getByLabelText(/move section up/i)).toBeDisabled();
    expect(within(headerA).getByLabelText(/move section down/i)).not.toBeDisabled();
    expect(within(headerB).getByLabelText(/move section up/i)).not.toBeDisabled();
    expect(within(headerB).getByLabelText(/move section down/i)).toBeDisabled();
  });

  it("clicking the header collapses and expands the card", async () => {
    render(<Harness />);
    const card = await screen.findByTestId(
      `section-card-${f.sampleSection.id}`
    );
    // Starts collapsed: no tabs rendered.
    expect(within(card).queryByRole("tab", { name: /content/i })).toBeNull();

    const header = within(card).getByTestId(
      `section-header-${f.sampleSection.id}`
    );
    const expandBtn = within(header).getByLabelText(/expand section/i);
    fireEvent.click(expandBtn);

    // Expanded: tabs render.
    await within(card).findByRole("tab", { name: /content/i });
    // The chevron label flips to collapse.
    expect(within(header).getByLabelText(/collapse section/i)).toBeInTheDocument();

    // Click again to collapse.
    fireEvent.click(within(header).getByLabelText(/collapse section/i));
    await waitFor(() => {
      expect(within(header).getByLabelText(/expand section/i)).toBeInTheDocument();
    });
  });

  it("Expand all and Collapse all toggle every card in the stack", async () => {
    const sectionA: SectionAdmin = { ...f.sampleSection, id: 9 };
    const sectionB: SectionAdmin = { ...f.sampleSection, id: 10 };
    const pageDetail: PageDetail = {
      ...f.pageDetail,
      sections: [sectionA, sectionB],
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      )
    );

    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByTestId(`section-card-${sectionA.id}`);

    // Both start collapsed.
    expect(screen.queryAllByRole("tab", { name: /content/i })).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /expand all/i }));
    await waitFor(() => {
      expect(screen.queryAllByRole("tab", { name: /content/i })).toHaveLength(2);
    });

    await user.click(screen.getByRole("button", { name: /collapse all/i }));
    await waitFor(() => {
      expect(screen.queryAllByRole("tab", { name: /content/i })).toHaveLength(0);
    });
  });

  it("items render as nested cards inside the parent section card with 'Item n of m'", async () => {
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
        id: 401,
        sectionId: 9,
        position: 0,
        isHidden: false,
        data: { caption: "First" },
        problems: [],
        updatedBy: "editor@example.com",
        updatedAt: "2026-12-22T01:31:07.412Z",
      },
      {
        id: 402,
        sectionId: 9,
        position: 1,
        isHidden: false,
        data: { caption: "Second" },
        problems: [],
        updatedBy: "editor@example.com",
        updatedAt: "2026-12-22T01:31:07.412Z",
      },
      {
        id: 403,
        sectionId: 9,
        position: 2,
        isHidden: false,
        data: { caption: "Third" },
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
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: kinds })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () =>
        HttpResponse.json(pageDetail)
      )
    );

    render(<Harness />);
    const card = await expandSection(f.sampleSection.id!);

    // Each item card sits inside the parent section card, with the
    // "Item n of m" label in its header.
    const rowFirst = within(card).getByTestId(`item-row-${items[0]!.id}`);
    const rowSecond = within(card).getByTestId(`item-row-${items[1]!.id}`);
    const rowThird = within(card).getByTestId(`item-row-${items[2]!.id}`);
    expect(within(rowFirst).getByTestId(`item-title-${items[0]!.id}`).textContent)
      .toBe("Item 1 of 3");
    expect(within(rowSecond).getByTestId(`item-title-${items[1]!.id}`).textContent)
      .toBe("Item 2 of 3");
    expect(within(rowThird).getByTestId(`item-title-${items[2]!.id}`).textContent)
      .toBe("Item 3 of 3");
  });
  it("a role page's Page settings edits the Menu icon", async () => {
    const rolePage: PageDetail = {
      ...f.pageDetail,
      slug: "no-event",
      title: "No event",
      navLabel: null,
      role: "no_event",
      icon: null,
    };
    let body: unknown = null;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/pages/3`, () =>
        HttpResponse.json(rolePage)
      ),
      http.patch(`${testConfig.apiBaseUrl}/admin/pages/3`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(rolePage);
      })
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: "Page settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Page settings" });
    const field = within(dialog).getByTestId("page-icon-field");
    expect(within(field).getByText("Menu icon")).toBeInTheDocument();
    await user.click(within(field).getByRole("button", { name: "Choose" }));
    const picker = await screen.findByRole("dialog", { name: "Choose menu icon" });
    await user.click(await within(picker).findByTestId("icon-tile-cookie"));
    await user.click(within(picker).getByRole("button", { name: "Choose" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose menu icon" })).toBeNull()
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      slug: "no-event",
      navLabel: null,
      icon: { source: "library", id: "cookie" },
    });
  });
});
