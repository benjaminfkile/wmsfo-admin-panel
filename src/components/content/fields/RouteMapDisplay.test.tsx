import { describe, it, expect } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import RouteMapDisplayControls from "./RouteMapDisplayControls";
import { buildTheme } from "../../../theme/theme";
import { resolveDisplayKey, withDisplayKey, type RouteMapDisplay } from "../routeMapDisplay";

function Controlled({ initial, resettable }: { initial?: RouteMapDisplay; resettable?: boolean }) {
  const [value, setValue] = useState<RouteMapDisplay | undefined>(initial);
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <RouteMapDisplayControls
        value={value}
        onChange={setValue}
        testId="route-map-display"
        title="Route line and labels"
        resettable={resettable}
      />
      <pre data-testid="value">{JSON.stringify(value ?? null)}</pre>
    </ThemeProvider>
  );
}

function written(): unknown {
  return JSON.parse(screen.getByTestId("value").textContent ?? "null");
}

function pick(name: RegExp, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name }));
  const listbox = screen.getByRole("listbox");
  fireEvent.click(within(listbox).getByRole("option", { name: option }));
}

describe("routeMapDisplay helpers", () => {
  it("resolves each key from the first level that sets a valid value, else the default", () => {
    expect(resolveDisplayKey([{ arrowSize: "large" }, { arrowSize: "small" }], "arrowSize")).toBe("large");
    expect(resolveDisplayKey([{}, { arrowSize: "small" }], "arrowSize")).toBe("small");
    expect(resolveDisplayKey([{ arrowSize: "huge" }], "arrowSize")).toBe("medium");
    expect(resolveDisplayKey([undefined], "timeLabelIntervalMinutes")).toBe(15);
    expect(resolveDisplayKey([{ arrows: false }], "arrows")).toBe(false);
    expect(resolveDisplayKey([null], "routeWidth")).toBe("normal");
  });

  it("sets and removes one key and returns undefined for an empty block", () => {
    expect(withDisplayKey(undefined, "arrows", false)).toEqual({ arrows: false });
    expect(withDisplayKey({ arrows: false, routeWidth: "thin" }, "arrows", undefined)).toEqual({
      routeWidth: "thin",
    });
    expect(withDisplayKey({ arrows: false }, "arrows", undefined)).toBeUndefined();
  });
});

describe("RouteMapDisplayControls", () => {
  it("shows the built-in defaults while unset and writes nothing", () => {
    render(<Controlled />);
    const group = screen.getByTestId("route-map-display");
    expect(within(group).getByText("Route line and labels")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /time labels/i })).toHaveTextContent(
      "Every 15 minutes"
    );
    expect(screen.getByRole("switch", { name: "Arrows" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /arrow size/i })).toHaveTextContent("Medium");
    expect(screen.getByRole("combobox", { name: /route line/i })).toHaveTextContent("Normal");
    expect(within(group).getByText("How thick the route line is drawn.")).toBeInTheDocument();
    expect(written()).toBeNull();
  });

  it("writes only each picked value", () => {
    render(<Controlled />);
    pick(/time labels/i, "Off");
    expect(written()).toEqual({ timeLabelIntervalMinutes: 0 });
    fireEvent.click(screen.getByRole("switch", { name: "Arrows" }));
    expect(written()).toEqual({ timeLabelIntervalMinutes: 0, arrows: false });
    pick(/arrow size/i, "Extra large");
    pick(/route line/i, "Extra thick");
    expect(written()).toEqual({
      timeLabelIntervalMinutes: 0,
      arrows: false,
      arrowSize: "xlarge",
      routeWidth: "xthick",
    });
    expect(screen.getByRole("combobox", { name: /time labels/i })).toHaveTextContent("Off");
  });

  it("shows stored values", () => {
    render(
      <Controlled initial={{ timeLabelIntervalMinutes: 5, arrows: false, routeWidth: "thick" }} />
    );
    expect(screen.getByRole("combobox", { name: /time labels/i })).toHaveTextContent(
      "Every 5 minutes"
    );
    expect(screen.getByRole("switch", { name: "Arrows" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: /route line/i })).toHaveTextContent("Thick");
  });

  it("resets a set key to the built-in default when resettable", () => {
    render(<Controlled initial={{ routeWidth: "thick", arrows: false }} resettable />);
    expect(screen.queryByRole("button", { name: "Default Time labels" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Default Route line" }));
    expect(written()).toEqual({ arrows: false });
    expect(screen.getByRole("combobox", { name: /route line/i })).toHaveTextContent("Normal");
    fireEvent.click(screen.getByRole("button", { name: "Default Arrows" }));
    expect(written()).toBeNull();
    expect(screen.getByRole("switch", { name: "Arrows" })).toBeChecked();
  });

  it("shows Label size as Medium until picked, then writes only the pick", () => {
    render(<Controlled resettable />);
    const select = screen.getByRole("combobox", { name: /label size/i });
    expect(select).toHaveTextContent("Medium");
    expect(
      screen.getByText("How big the time labels and viewpoint names are drawn.")
    ).toBeInTheDocument();
    expect(written()).toBeNull();
    pick(/label size/i, "Large");
    expect(written()).toEqual({ labelSize: "large" });
    pick(/label size/i, "Medium");
    expect(written()).toEqual({ labelSize: "medium" });
    fireEvent.click(screen.getByRole("button", { name: "Default Label size" }));
    expect(written()).toBeNull();
    expect(screen.getByRole("combobox", { name: /label size/i })).toHaveTextContent("Medium");
  });

  it("shows a stored label size and reads a value outside the contract as unset", () => {
    const { unmount } = render(<Controlled initial={{ labelSize: "small" }} />);
    expect(screen.getByRole("combobox", { name: /label size/i })).toHaveTextContent("Small");
    unmount();
    render(<Controlled initial={{ labelSize: "huge" }} />);
    expect(screen.getByRole("combobox", { name: /label size/i })).toHaveTextContent("Medium");
    expect(resolveDisplayKey([{ labelSize: "huge" }], "labelSize")).toBe("medium");
  });
});
