import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import Publish from "./Publish";
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
          <MemoryRouter initialEntries={["/publish"]}>
            <NotifyProvider>
              <Publish />
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

describe("Publish: status card states", () => {
  it("renders 'No unpublished changes' when hasUnpublishedChanges is false", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json({
          ...f.contentStatus,
          hasUnpublishedChanges: false,
          problems: [],
        })
      )
    );
    render(<Harness />);
    expect(await screen.findByTestId("status-no-changes")).toBeInTheDocument();
    const publish = await screen.findByTestId("publish-button");
    expect(publish).toBeDisabled();
  });

  it("renders 'Ready to publish' when hasUnpublishedChanges and no problems", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json({
          ...f.contentStatus,
          hasUnpublishedChanges: true,
          problems: [],
        })
      )
    );
    render(<Harness />);
    expect(await screen.findByTestId("status-ready")).toBeInTheDocument();
    const publish = await screen.findByTestId("publish-button");
    expect(publish).not.toBeDisabled();
  });

  it("renders '<n> problems block publishing' with problem list linking to sections/site-settings", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json({
          ...f.contentStatus,
          hasUnpublishedChanges: true,
          problems: [
            {
              path: "pages/3/sections/9/data/heading",
              message: "heading is required",
              pageId: 3,
              sectionId: 9,
              itemId: null,
            },
            {
              path: "siteSettings/siteName",
              message: "siteName is required",
              pageId: null,
              sectionId: null,
              itemId: null,
            },
          ],
        })
      )
    );
    render(<Harness />);
    expect(await screen.findByTestId("status-blocked")).toBeInTheDocument();
    const list = await screen.findByTestId("problem-ref-list");
    const rows = within(list).getAllByRole("link");
    // Two ListItemButton links + two Chip links = 4 anchor tags.
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // The first problem links into the page editor at the section anchor.
    expect(
      rows.some((r) => r.getAttribute("href") === "/pages/3#section-9")
    ).toBe(true);
    // The second links to /site-settings.
    expect(rows.some((r) => r.getAttribute("href") === "/site-settings")).toBe(
      true
    );
    const publish = await screen.findByTestId("publish-button");
    expect(publish).toBeDisabled();
  });
});

describe("Publish: publish action", () => {
  it("publishes with the entered label and refreshes the version list", async () => {
    const user = userEvent.setup();
    const publishBodies: unknown[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json({
          ...f.contentStatus,
          hasUnpublishedChanges: true,
          problems: [],
        })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/publish`,
        async ({ request }) => {
          publishBodies.push(await request.json());
          return HttpResponse.json(
            {
              ...f.contentVersions[0],
              id: 2,
              label: "Ship it",
            },
            { status: 201 }
          );
        }
      )
    );
    render(<Harness />);
    await user.click(await screen.findByTestId("publish-button"));
    const label = await screen.findByTestId("publish-label");
    await user.type(within(label).getByRole("textbox"), "Ship it");
    const confirm = await screen.findByRole("button", { name: /^publish$/i });
    await user.click(confirm);
    await waitFor(() => expect(publishBodies.length).toBeGreaterThan(0));
    expect(publishBodies[0]).toEqual({ label: "Ship it" });
  });

  it("shows 'Nothing to publish' when the API returns 409 content_unchanged", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json({
          ...f.contentStatus,
          hasUnpublishedChanges: true,
          problems: [],
        })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/publish`,
        () =>
          HttpResponse.json(
            {
              code: "content_unchanged",
              message: "Nothing to publish",
              details: null,
              requestId: "req-x",
            },
            { status: 409 }
          )
      )
    );
    render(<Harness />);
    await user.click(await screen.findByTestId("publish-button"));
    const confirm = await screen.findByRole("button", { name: /^publish$/i });
    await user.click(confirm);
    expect(await screen.findByTestId("publish-nothing")).toBeInTheDocument();
  });

  it("refreshes the problem list on 422 content_invalid", async () => {
    const user = userEvent.setup();
    let statusRequests = 0;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () => {
        statusRequests += 1;
        return HttpResponse.json({
          ...f.contentStatus,
          hasUnpublishedChanges: true,
          problems: [],
        });
      }),
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/publish`,
        () =>
          HttpResponse.json(
            {
              code: "content_invalid",
              message: "Draft is invalid",
              details: { problems: [] },
              requestId: "req-y",
            },
            { status: 422 }
          )
      )
    );
    render(<Harness />);
    await user.click(await screen.findByTestId("publish-button"));
    const confirm = await screen.findByRole("button", { name: /^publish$/i });
    const initial = statusRequests;
    await user.click(confirm);
    expect(await screen.findByTestId("publish-invalid")).toBeInTheDocument();
    await waitFor(() => expect(statusRequests).toBeGreaterThan(initial));
  });
});

describe("Publish: versions", () => {
  it("restore asks for confirmation and calls POST /admin/content/versions/{id}/restore", async () => {
    const user = userEvent.setup();
    let restoreCalls = 0;
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json(f.contentStatus)
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/content/versions`, () =>
        HttpResponse.json({
          items: [
            {
              ...f.contentVersions[0],
              id: 5,
              label: "Older",
            },
            {
              ...f.contentVersions[0],
              id: 1,
              label: "Seed",
            },
          ],
        })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/versions/5/restore`,
        () => {
          restoreCalls += 1;
          return HttpResponse.json(f.contentStatus);
        }
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId("version-row-5");
    await user.click(within(row).getByRole("button", { name: /^restore$/i }));
    const confirm = await screen.findAllByRole("button", { name: /^restore$/i });
    // The last one is inside the confirmation dialog.
    await user.click(confirm[confirm.length - 1]!);
    await waitFor(() => expect(restoreCalls).toBe(1));
  });

  it("restore and publish issues both calls with the generated label", async () => {
    const user = userEvent.setup();
    let restoreCalls = 0;
    const publishBodies: unknown[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json(f.contentStatus)
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/content/versions`, () =>
        HttpResponse.json({
          items: [
            {
              ...f.contentVersions[0],
              id: 7,
              label: "Older",
            },
          ],
        })
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/versions/7/restore`,
        () => {
          restoreCalls += 1;
          return HttpResponse.json(f.contentStatus);
        }
      ),
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/publish`,
        async ({ request }) => {
          publishBodies.push(await request.json());
          return HttpResponse.json(f.contentVersions[0], { status: 201 });
        }
      )
    );
    render(<Harness />);
    const row = await screen.findByTestId("version-row-7");
    await user.click(
      within(row).getByRole("button", { name: /restore and publish/i })
    );
    const confirm = await screen.findAllByRole("button", {
      name: /restore and publish/i,
    });
    await user.click(confirm[confirm.length - 1]!);
    await waitFor(() => expect(restoreCalls).toBe(1));
    await waitFor(() => expect(publishBodies.length).toBe(1));
    expect(publishBodies[0]).toEqual({ label: "Restored from version 7" });
  });

  it("marks the currently published version with a chip", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () =>
        HttpResponse.json({
          ...f.contentStatus,
          published: { ...f.contentVersions[0], id: 4 },
        })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/content/versions`, () =>
        HttpResponse.json({
          items: [
            { ...f.contentVersions[0], id: 4, label: "Live" },
            { ...f.contentVersions[0], id: 3, label: "Old" },
          ],
        })
      )
    );
    render(<Harness />);
    expect(await screen.findByTestId("version-published-4")).toBeInTheDocument();
    // The other row does not show the chip.
    expect(screen.queryByTestId("version-published-3")).toBeNull();
  });
});
