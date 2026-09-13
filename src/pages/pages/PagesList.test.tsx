// admin.md 9.2, Pages row:
//   - role pages render no delete action
//   - drag reorder sends PUT /admin/pages/order with every `none` id
//     in the new order
//   - the delete confirmation names the page's section count

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
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
    // Fixture About page has sectionCount = 2.
    expect(dialog.textContent).toMatch(/and its 2 sections/i);
    // The page title and slug are mentioned too.
    expect(dialog.textContent).toMatch(/About/);
    expect(dialog.textContent).toMatch(/\/about/);
  });
});
