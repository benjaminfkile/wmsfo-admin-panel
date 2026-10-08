import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseBody, renderBody } from "./helpText";

describe("helpText", () => {
  it("splits on blank lines into paragraphs", () => {
    expect(parseBody("First line\nstill first.\n\nSecond.")).toEqual([
      { kind: "paragraph", text: "First line still first." },
      { kind: "paragraph", text: "Second." },
    ]);
    render(<div>{renderBody("One.\n\nTwo.")}</div>);
    expect(screen.getByText("One.").tagName).toBe("P");
    expect(screen.getByText("Two.").tagName).toBe("P");
  });

  it("turns a run of lines starting with a hyphen and a space into a list", () => {
    expect(parseBody("- a\n- b\n- c")).toEqual([
      { kind: "bullets", items: ["a", "b", "c"] },
    ]);
    render(<div>{renderBody("- apples\n- pears")}</div>);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["apples", "pears"]);
  });

  it("reads a mixed body in order and treats nothing else as markup", () => {
    expect(
      parseBody("Intro *not bold*\n- one\n- two\nAfter the list.\n\n-not a bullet")
    ).toEqual([
      { kind: "paragraph", text: "Intro *not bold*" },
      { kind: "bullets", items: ["one", "two"] },
      { kind: "paragraph", text: "After the list." },
      { kind: "paragraph", text: "-not a bullet" },
    ]);
    expect(parseBody("")).toEqual([]);
    expect(parseBody(undefined)).toEqual([]);
  });
});
