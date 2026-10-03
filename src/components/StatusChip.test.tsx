import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusChip from "./StatusChip";

describe("StatusChip", () => {
  it("renders Postponed as an outlined warning chip", () => {
    render(<StatusChip statusId={6} />);
    const chip = screen.getByText("Postponed").closest(".MuiChip-root");
    expect(chip).toHaveClass("MuiChip-outlinedWarning");
  });
});
