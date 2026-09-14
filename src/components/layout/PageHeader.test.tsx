import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { buildTheme } from "../../theme/theme";
import PageHeader from "./PageHeader";

// PageHeader flips its layout at the `md` breakpoint through
// `useMediaQuery` and `useCompact`. Stub `window.matchMedia` for the
// two states.
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

function renderWithTheme(node: React.ReactNode) {
  return render(<ThemeProvider theme={buildTheme("light")}>{node}</ThemeProvider>);
}

describe("PageHeader", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("puts the actions row under the title on compact", () => {
    restore = stubMatchMedia(true);
    renderWithTheme(
      <PageHeader
        title="Events"
        actions={<button data-testid="new-event">New event</button>}
      />
    );

    const title = screen.getByRole("heading", { name: "Events" });
    const action = screen.getByTestId("new-event");
    // The action lives outside the row that holds the title on compact,
    // so its containing element is a later sibling in the DOM.
    const compare = title.compareDocumentPosition(action);
    expect(compare & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The heading collapses to h5 on compact.
    expect(title.tagName).toBe("H5");
  });

  it("keeps the actions row inline with the title on desktop", () => {
    restore = stubMatchMedia(false);
    renderWithTheme(
      <PageHeader
        title="Events"
        actions={<button data-testid="new-event">New event</button>}
      />
    );

    const title = screen.getByRole("heading", { name: "Events" });
    // The desktop title uses h4.
    expect(title.tagName).toBe("H4");
    // The action button renders exactly once on desktop.
    expect(screen.getAllByTestId("new-event")).toHaveLength(1);
  });
});
