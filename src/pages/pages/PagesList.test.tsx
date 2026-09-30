// admin.md 9.2, Pages row:
//   - role pages render no delete action
//   - drag reorder sends PUT /admin/pages/order with every `none` id
//     in the new order
//   - the delete confirmation names the page's section count
//   - "Preview site" opens the preview dialog at the home page with Share
// admin.md 6.13, the Menu icon:
//   - a page with an icon shows a small preview before its title; a
//     page without one shows none
//   - New page sends the picked icon; the settings dialog sends the
//     edited icon with PATCH

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PagesList from "./PagesList";
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
import type { PageAdmin } from "../../api/types";

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
          <MemoryRouter initialEntries={["/pages"]}>
            <NotifyProvider>
              <PagesList />
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

describe("PagesList", () => {
  it("role pages render no delete action", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // The No event status page is a role page: no actions menu, only a pencil.
    const statusRow = await screen.findByTestId(`page-row-${1}`);
    expect(
      within(statusRow).queryByRole("button", { name: /actions for/i })
    ).toBeNull();
    expect(within(statusRow).queryByLabelText(/^delete/i)).toBeNull();
    // The pencil is present.
    expect(
      within(statusRow).getByRole("link", { name: /edit no event/i })
    ).toBeInTheDocument();

    // The About page (role "none") has an actions menu with Delete.
    const nonRoleRow = await screen.findByTestId(`page-row-${3}`);
    const menuBtn = within(nonRoleRow).getByRole("button", {
      name: /actions for/i,
    });
    await user.click(menuBtn);
    expect(
      await screen.findByRole("menuitem", { name: /^delete$/i })
    ).toBeInTheDocument();
  });

  it("drag reorder sends PUT /admin/pages/order with every `none` id in the new order", async () => {
    // Provide two `none` pages so a reorder is meaningful.
    const nonePages: PageAdmin[] = [
      {
        ...(f.pageAdmin[1] as PageAdmin),
        id: 3,
        slug: "about",
        title: "About",
        navPosition: 10,
      },
      {
        ...(f.pageAdmin[1] as PageAdmin),
        id: 4,
        slug: "contact",
        title: "Contact",
        navPosition: 20,
      },
    ];
    const listItems: PageAdmin[] = [
      f.pageAdmin[0] as PageAdmin,
      ...nonePages,
    ];
    let orderBody: unknown = null;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/pages`, () =>
        HttpResponse.json({ items: listItems })
      ),
      http.put(
        `${testConfig.apiBaseUrl}/admin/pages/order`,
        async ({ request }) => {
          orderBody = await request.json();
          return HttpResponse.json({ items: listItems });
        }
      )
    );
    const user = userEvent.setup();
    render(<Harness />);

    // Wait for both `none` rows.
    await screen.findByTestId(`page-row-${3}`);
    const contactRow = await screen.findByTestId(`page-row-${4}`);

    // The Contact row is second; move it up so the order becomes [4, 3].
    const moveUp = within(contactRow).getByLabelText(/move up/i);
    await user.click(moveUp);

    await waitFor(() => {
      expect(orderBody).not.toBeNull();
    });
    // Body must be { ids: [4, 3] } - every `none` id in the new order.
    expect(orderBody).toEqual({ ids: [4, 3] });
  });

  it("Preview site opens the preview dialog at home with the Share menu", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    let tokens = 0;
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/content/preview-token`, () => {
        tokens += 1;
        return HttpResponse.json(f.previewToken, { status: 201 });
      })
    );
    try {
      render(<Harness />);
      await user.click(
        await screen.findByRole("button", { name: "Preview site" })
      );
      const iframe = await screen.findByTestId("preview-iframe");
      expect(tokens).toBe(1);
      expect(iframe.getAttribute("src")).toContain(f.previewToken.token);
      expect(iframe.getAttribute("src")).not.toMatch(/[?&]page=/);
      const select = screen.getByTestId("preview-page-select");
      expect(within(select).getByText("Start at", { selector: "label" })).toBeInTheDocument();
      expect(within(select).getByRole("combobox")).toHaveTextContent("Home");
      expect(
        screen.getByText("Click around: every page shows your draft.")
      ).toBeInTheDocument();

      await user.click(screen.getByTestId("preview-share"));
      const menu = await screen.findByTestId("preview-share-menu");
      await user.click(within(menu).getByTestId("preview-share-open"));
      await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
      expect(tokens).toBe(2);
      const [url, target, features] = open.mock.calls[0] ?? [];
      expect(String(url)).toMatch(/\/preview\?token=wpv_/);
      expect(String(url)).not.toMatch(/[?&]page=/);
      expect(target).toBe("_blank");
      expect(features).toBe("noopener");
    } finally {
      open.mockRestore();
    }
  });

  it("renders a card per page on compact with the pencil", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(<Harness />);
      const statusCard = await screen.findByTestId(`page-row-${1}`);
      expect(
        within(statusCard).getByRole("link", { name: /edit no event/i })
      ).toBeInTheDocument();
      const nonRoleCard = await screen.findByTestId(`page-row-${3}`);
      expect(
        within(nonRoleCard).getByRole("link", { name: /edit about/i })
      ).toBeInTheDocument();
      expect(
        within(nonRoleCard).getByRole("button", {
          name: /actions for about/i,
        })
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
    } finally {
      restore();
    }
  });

  it("delete confirmation names the page's section count", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const nonRoleRow = await screen.findByTestId(`page-row-${3}`);
    await user.click(
      within(nonRoleRow).getByRole("button", { name: /actions for/i })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /^delete$/i })
    );

    const dialog = await screen.findByRole("dialog");
    // The new DeleteDialog (admin.md 8.3) titles with the page name and
    // groups the cascade under "Also deleted" - from the impact fixture
    // for pages/3, that is 2 sections.
    expect(dialog.textContent).toMatch(/Delete About/i);
    expect(dialog.textContent).toMatch(/also deleted/i);
    expect(dialog.textContent).toMatch(/2 sections/i);
  });
  it("a page with a Menu icon shows a small preview; one without shows none", async () => {
    const withIcon: PageAdmin = {
      ...(f.pageAdmin[1] as PageAdmin),
      icon: { source: "library", id: "cookie" },
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/pages`, () =>
        HttpResponse.json({ items: [f.pageAdmin[0], withIcon] })
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId(`page-row-${3}`);
    const preview = await within(row).findByTestId("page-icon-3");
    const img = await within(preview).findByTestId("icon-preview-image");
    expect(img).toHaveAttribute("src", "https://cdn.example/icons/bb22.svg");
    expect(img).toHaveStyle({ width: "20px" });
    expect(within(preview).getByRole("link", { name: "About" })).toBeInTheDocument();
    const statusRow = screen.getByTestId(`page-row-${1}`);
    expect(within(statusRow).queryByTestId("page-icon-1")).toBeNull();
    expect(within(statusRow).queryByTestId("icon-preview-image")).toBeNull();
  });

  it("New page sends the picked Menu icon", async () => {
    let body: unknown = null;
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/pages`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(f.pageAdmin[1], { status: 201 });
      })
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: "New page" }));
    const dialog = await screen.findByRole("dialog", { name: "New page" });
    await user.type(within(dialog).getByLabelText(/^Title/), "Donate");
    await user.click(
      within(within(dialog).getByTestId("page-icon-field")).getByRole("button", {
        name: "Choose",
      })
    );
    const picker = await screen.findByRole("dialog", { name: "Choose menu icon" });
    await user.click(await within(picker).findByTestId("icon-tile-cookie"));
    await user.click(within(picker).getByRole("button", { name: "Choose" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choose menu icon" })).toBeNull()
    );
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({
      slug: "donate",
      title: "Donate",
      navLabel: "Donate",
      icon: { source: "library", id: "cookie" },
    });
  });

  it("the settings dialog clears the Menu icon with PATCH icon null", async () => {
    const withIcon: PageAdmin = {
      ...(f.pageAdmin[1] as PageAdmin),
      icon: { source: "library", id: "cookie" },
    };
    let body: unknown = null;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/pages`, () =>
        HttpResponse.json({ items: [f.pageAdmin[0], withIcon] })
      ),
      http.patch(`${testConfig.apiBaseUrl}/admin/pages/3`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...withIcon, icon: null });
      })
    );
    const user = userEvent.setup();
    render(<Harness />);
    const row = await screen.findByTestId(`page-row-${3}`);
    await user.click(within(row).getByRole("button", { name: /settings for about/i }));
    const dialog = await screen.findByRole("dialog", { name: "Page settings" });
    const field = within(dialog).getByTestId("page-icon-field");
    await user.click(within(field).getByRole("button", { name: "Clear" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({
      slug: "about",
      title: "About",
      navLabel: "About",
      icon: null,
      isHidden: false,
    });
  });
});
