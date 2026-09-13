// admin.md 7.3: the always-visible Expected shape panel shows the
// vendored contracts fixture with schemaVersion stripped, so the panel
// cannot drift from the contract. Copy writes the same body to the
// clipboard.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { NotifyProvider } from "../../hooks/useNotify";
import { buildTheme } from "../../theme/theme";
import RouteUploadDialog, { ROUTE_EXAMPLE_JSON } from "./RouteUploadDialog";
import routeFixture from "../../../contracts/fixtures/route.json";

function Harness() {
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <NotifyProvider>
        <RouteUploadDialog
          open
          submitting={false}
          error={null}
          onCancel={() => undefined}
          onSubmit={() => undefined}
        />
      </NotifyProvider>
    </ThemeProvider>
  );
}

describe("RouteUploadDialog Expected shape panel", () => {
  it("panel example equals the fixture minus schemaVersion", () => {
    const source = routeFixture as Record<string, unknown>;
    const expected: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) {
      if (k === "schemaVersion") continue;
      expected[k] = v;
    }
    const parsed = JSON.parse(ROUTE_EXAMPLE_JSON) as Record<string, unknown>;
    expect(parsed).toEqual(expected);
    expect(parsed).not.toHaveProperty("schemaVersion");
  });

  it("Copy button writes the example JSON to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      render(<Harness />);
      fireEvent.click(await screen.findByLabelText(/copy example/i));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText).toHaveBeenCalledWith(ROUTE_EXAMPLE_JSON);
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it("panel is always visible and lists the rules", async () => {
    render(<Harness />);
    expect(await screen.findByTestId("route-shape-panel")).toBeInTheDocument();
    expect(await screen.findByTestId("route-shape-example")).toBeInTheDocument();
    expect(
      screen.getByText(/name: 1 to 200 characters/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/points: 2 to 50,000 in flight order/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no other keys; at most 5 MB/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /download example/i })
    ).toBeInTheDocument();
  });
});
