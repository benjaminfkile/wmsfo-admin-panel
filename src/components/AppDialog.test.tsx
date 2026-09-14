import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { buildTheme } from "../theme/theme";
import AppDialog from "./AppDialog";

// AppDialog flips to full screen below `sm`. In jsdom the tests stub
// `window.matchMedia` so `useMediaQuery` inside AppDialog decides which
// path to render.
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

// MUI puts `role="dialog"` on the same element that carries the
// `MuiDialog-paperFullScreen` class when fullScreen is on; the test
// asserts the class from the element document.body already contains
// (querying by role is enough).
function paperClassName(): string {
  const paper = document.body.querySelector<HTMLElement>(".MuiDialog-paper");
  return paper?.className ?? "";
}

describe("AppDialog", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("mounts full screen below sm", () => {
    restore = stubMatchMedia(true);
    renderWithTheme(
      <AppDialog open>
        <div>content</div>
      </AppDialog>
    );
    // The dialog is mounted; its Paper carries the paperFullScreen class.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(paperClassName()).toMatch(/MuiDialog-paperFullScreen/);
  });

  it("does not mount full screen at sm and above", () => {
    restore = stubMatchMedia(false);
    renderWithTheme(
      <AppDialog open>
        <div>content</div>
      </AppDialog>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(paperClassName()).not.toMatch(/MuiDialog-paperFullScreen/);
  });

  it("honours an explicit fullScreen prop when it disagrees with the viewport", () => {
    restore = stubMatchMedia(false);
    renderWithTheme(
      <AppDialog open fullScreen>
        <div>content</div>
      </AppDialog>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(paperClassName()).toMatch(/MuiDialog-paperFullScreen/);
  });
});
