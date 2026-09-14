import { afterEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeFakeUserManager, makeUser } from "../../test/renderWithProviders";
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
      <MainLayout
        role="admin"
        email="admin@example.com"
        themeMode="light"
        onToggleTheme={() => undefined}
      />,
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
      <MainLayout
        role="admin"
        email="admin@example.com"
        themeMode="light"
        onToggleTheme={() => undefined}
      />,
      { userManager: um }
    );

    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /open navigation/i })
    ).not.toBeInTheDocument();
  });
});
