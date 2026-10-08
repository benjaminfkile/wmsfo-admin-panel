import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import {
  renderWithProviders,
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import type { Role } from "../../auth/claims";
import MainLayout from "./MainLayout";

// The compact layout hinges on MUI's `useMediaQuery`, which reads
// `window.matchMedia`. jsdom does not implement it, so the tests stub it
// with a matcher that answers "matches" to any breakpoints.down("md")
// query. A tiny helper toggles the stub back off in afterEach so the
// desktop assertion runs in the default (no-match) state.
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

function makeAdminUser() {
  return makeUser({
    "cognito:groups": ["admin"],
    email: "admin@example.com",
  });
}

describe("MainLayout on compact", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("shows the menu button, hides the email, and reveals the close button and scrolling list when opened", async () => {
    restore = stubMatchMedia(true);
    const um = makeFakeUserManager(makeAdminUser());
    renderWithProviders(
      <NotifyProvider>
        <MainLayout
          role="admin"
          email="admin@example.com"
          themeMode="light"
          onToggleTheme={() => undefined}
        />
      </NotifyProvider>,
      { userManager: um }
    );

    // The email is hidden in the bar below `md` through a responsive
    // `display` sx (jsdom does not evaluate media queries), and the menu
    // button is rendered in its place.
    const email = screen.getByTestId("app-bar-email");
    const emailClasses = document.head.querySelectorAll("style");
    const classNames = email.getAttribute("class") ?? "";
    // Emotion emits a `.css-*` class whose stylesheet contains the
    // responsive display rules; assert the rule exists in the emitted
    // sheets rather than trusting jsdom's computed style.
    let hidesOnXs = false;
    for (const sheet of Array.from(emailClasses)) {
      const text = sheet.textContent ?? "";
      if (
        classNames
          .split(" ")
          .some((c) => c.length > 0 && text.includes(`.${c}`)) &&
        text.includes("display:none")
      ) {
        hidesOnXs = true;
        break;
      }
    }
    expect(hidesOnXs).toBe(true);
    const menu = screen.getByRole("button", { name: /open navigation/i });
    expect(menu).toBeInTheDocument();

    // Opening the temporary drawer surfaces the close button and its
    // scrollable list.
    await userEvent.click(menu);
    const close = await screen.findByRole("button", { name: /close navigation/i });
    expect(close).toBeInTheDocument();

    // The list inside the drawer scrolls when its content overflows: the
    // Layout wires `overflowY: auto` and `flex: 1` on the `List` inside
    // the paper.
    const list = screen
      .getAllByRole("list")
      .find((el) => within(el).queryByText("Dashboard") !== null);
    expect(list).toBeDefined();
    expect(list!).toHaveStyle({ overflowY: "auto" });
  });

  it("keeps the email in the bar and does not render the menu button on desktop", () => {
    restore = stubMatchMedia(false);
    const um = makeFakeUserManager(makeAdminUser());
    renderWithProviders(
      <NotifyProvider>
        <MainLayout
          role="admin"
          email="admin@example.com"
          themeMode="light"
          onToggleTheme={() => undefined}
        />
      </NotifyProvider>,
      { userManager: um }
    );

    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /open navigation/i })
    ).not.toBeInTheDocument();
  });

  it("mounts the environment badge help in the bar and the drawer help in the drawer title row", () => {
    restore = stubMatchMedia(false);
    const um = makeFakeUserManager(makeAdminUser());
    renderWithProviders(
      <NotifyProvider>
        <MainLayout
          role="admin"
          email="admin@example.com"
          themeMode="light"
          onToggleTheme={() => undefined}
        />
      </NotifyProvider>,
      { userManager: um }
    );

    expect(screen.getByTestId("help-bar.env-badge")).toBeInTheDocument();
    expect(screen.getByTestId("help-drawer")).toBeInTheDocument();
  });
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLayout(role: Role) {
  const um = makeFakeUserManager(
    makeUser({ "cognito:groups": [role], email: `${role}@example.com` })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  return renderWithProviders(
    <NotifyProvider>
      <MainLayout
        role={role}
        email={`${role}@example.com`}
        themeMode="light"
        onToggleTheme={() => undefined}
      />
      <LocationProbe />
    </NotifyProvider>,
    { userManager: um }
  );
}

const PROBLEMS = [
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
];

describe("MainLayout: the bar's Publish button", () => {
  let restore: (() => void) | null = null;
  let statusRequests = 0;

  function serveStatus(over: Partial<typeof f.contentStatus>) {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/status`, () => {
        statusRequests += 1;
        return HttpResponse.json({ ...f.contentStatus, ...over });
      })
    );
  }

  beforeEach(() => {
    statusRequests = 0;
    restore = stubMatchMedia(false);
  });

  afterEach(() => {
    restore?.();
    restore = null;
    server.resetHandlers();
  });

  it("publishes with the label from the dialog when there are changes and no problems", async () => {
    const user = userEvent.setup();
    const publishBodies: unknown[] = [];
    serveStatus({ hasUnpublishedChanges: true, problems: [] });
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/publish`,
        async ({ request }) => {
          publishBodies.push(await request.json());
          return HttpResponse.json(
            { ...f.contentVersions[0], id: 9, label: "From the bar" },
            { status: 201 }
          );
        }
      )
    );
    renderLayout("admin");

    const button = await screen.findByTestId("bar-publish");
    expect(button).toHaveTextContent("Publish");
    await user.click(button);
    const label = await screen.findByTestId("publish-label");
    expect(screen.getByTestId("help-bar.publish")).toBeInTheDocument();
    await user.type(within(label).getByRole("textbox"), "From the bar");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^publish$/i }));

    await waitFor(() => expect(publishBodies).toHaveLength(1));
    expect(publishBodies[0]).toEqual({ label: "From the bar" });
    expect(await screen.findByText("Published version 9")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
  });

  it("shows the problem count and opens the Publish page when there are problems", async () => {
    const user = userEvent.setup();
    serveStatus({ hasUnpublishedChanges: true, problems: PROBLEMS });
    renderLayout("editor");

    const button = await screen.findByTestId("bar-publish");
    expect(screen.getByTestId("bar-publish-problems")).toHaveTextContent("2");
    await user.click(button);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/publish$/);
    expect(screen.queryByTestId("publish-label")).not.toBeInTheDocument();
  });

  it("renders no button while there are no unpublished changes", async () => {
    serveStatus({ hasUnpublishedChanges: false, problems: [] });
    renderLayout("admin");
    await waitFor(() => expect(statusRequests).toBeGreaterThan(0));
    // Let the response settle before asserting the button stays absent.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("bar-publish")).not.toBeInTheDocument();
  });

  it("never renders the button or queries the status for a canvasser", async () => {
    serveStatus({ hasUnpublishedChanges: true, problems: [] });
    renderLayout("canvasser");
    expect(screen.getByText("canvasser@example.com")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(statusRequests).toBe(0);
    expect(screen.queryByTestId("bar-publish")).not.toBeInTheDocument();
  });

  it("renders an icon button named Publish on compact", async () => {
    restore?.();
    restore = stubMatchMedia(true);
    serveStatus({ hasUnpublishedChanges: true, problems: [] });
    renderLayout("admin");
    const button = await screen.findByRole("button", { name: "Publish" });
    expect(button).toHaveAttribute("data-testid", "bar-publish");
    expect(button).not.toHaveTextContent("Publish");
  });
});

describe("MainLayout: the Help entry", () => {
  let restore: (() => void) | null = null;

  beforeEach(() => {
    restore = stubMatchMedia(false);
  });

  afterEach(() => {
    restore?.();
    restore = null;
    server.resetHandlers();
  });

  it("shows Help after Audit in the drawer for admin and editor", async () => {
    for (const role of ["admin", "editor"] as Role[]) {
      const { unmount } = renderLayout(role);
      const links = screen
        .getAllByRole("link")
        .filter((a) => ["Audit", "Help"].includes(a.textContent ?? ""));
      expect(links.map((a) => a.textContent)).toEqual(["Audit", "Help"]);
      expect(links[1]).toHaveAttribute("href", "/help");
      await waitFor(() => expect(screen.getByTestId("location")).toBeInTheDocument());
      unmount();
    }
  });

  it("hides Help from a canvasser", async () => {
    renderLayout("canvasser");
    expect(await screen.findByRole("link", { name: "Scan" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Help" })).not.toBeInTheDocument();
  });
});
