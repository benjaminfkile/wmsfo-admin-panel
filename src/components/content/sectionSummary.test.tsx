import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import type { KindInfo, SectionAdmin } from "../../api/types";
import { sectionSummary } from "./sectionSummary";
import SectionCard from "./SectionCard";
import { buildTheme } from "../../theme/theme";

const currentEvent = vi.hoisted(() => ({
  value: null as null | {
    name: string;
    year: number | null;
    scheduledAt: string | null;
  },
}));

vi.mock("./useCurrentEvent", () => ({
  useCurrentEvent: () => currentEvent.value,
}));

const event = {
  name: "2026 Santa Flyover",
  year: 2026,
  scheduledAt: "2026-12-22T01:00:00.000Z",
};

function kind(k: string, hasItems = false): KindInfo {
  return { kind: k, title: k, hasItems } as unknown as KindInfo;
}

function section(data: object, id = 1): SectionAdmin {
  return { id, kind: "x", data, items: [] } as unknown as SectionAdmin;
}

describe("sectionSummary", () => {
  it("fills the hero title's event name from the event", () => {
    expect(
      sectionSummary(section({ title: "{event:name}" }), kind("hero"), event)
    ).toBe("2026 Santa Flyover");
  });

  it("is empty without a current event", () => {
    expect(
      sectionSummary(section({ title: "{event:name}" }), kind("hero"), null)
    ).toBe("");
  });

  it("removes inline markers from a heading", () => {
    expect(
      sectionSummary(
        section({ heading: "**Track** [Santa](/map) {icon:star}" }),
        kind("links"),
        null
      )
    ).toBe("Track Santa");
  });

  it("leaves a rich text summary unchanged", () => {
    const data = {
      blocks: [
        { kind: "heading", text: "**Hi**" },
        { kind: "paragraph", text: "{event:name}" },
        { kind: "list", items: ["a", "b", "c", "d"] },
      ],
    };
    expect(sectionSummary(section(data), kind("rich_text"), event)).toBe(
      "Heading, paragraph, list of 4"
    );
  });
});

describe("SectionCard summary", () => {
  function renderCard() {
    return render(
      <ThemeProvider theme={buildTheme("light")}>
        <SectionCard
          section={section({ title: "{event:name}" }, 7)}
          kind={kind("hero")}
          position={1}
          expanded={false}
          onToggleExpanded={() => undefined}
          onPatch={() => undefined}
        />
      </ThemeProvider>
    );
  }

  it("shows the hero title with the current event's name", () => {
    currentEvent.value = event;
    renderCard();
    expect(screen.getByTestId("section-summary-7")).toHaveTextContent(
      "2026 Santa Flyover"
    );
  });

  it("shows no summary without a current event", () => {
    currentEvent.value = null;
    renderCard();
    expect(screen.queryByTestId("section-summary-7")).toBeNull();
  });
});
