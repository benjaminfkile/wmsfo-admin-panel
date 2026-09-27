import { describe, expect, it } from "vitest";
import { inlineToPlainText } from "./renderInlinePreview";
import { formatStamp } from "../../lib/time";

const event = {
  name: "2026 Santa Flyover",
  year: 2026,
  scheduledAt: "2026-12-22T01:00:00.000Z",
};

describe("inlineToPlainText", () => {
  it("leaves plain text alone", () => {
    expect(inlineToPlainText("Hello there", null)).toBe("Hello there");
  });

  it("drops the bold markers", () => {
    expect(inlineToPlainText("a **big** day", null)).toBe("a big day");
  });

  it("drops the italic markers", () => {
    expect(inlineToPlainText("a *quiet* night", null)).toBe("a quiet night");
  });

  it("drops the code markers", () => {
    expect(inlineToPlainText("run `npm` now", null)).toBe("run npm now");
  });

  it("turns a link into its label", () => {
    expect(inlineToPlainText("see [the map](/map) here", null)).toBe(
      "see the map here"
    );
  });

  it("removes library and media icons", () => {
    expect(inlineToPlainText("{icon:star}Go{icon:media:42}", null)).toBe("Go");
  });

  it("turns a newline into a space", () => {
    expect(inlineToPlainText("one\ntwo", null)).toBe("one two");
  });

  it("fills the event placeholders from the event", () => {
    expect(inlineToPlainText("{event:name}", event)).toBe("2026 Santa Flyover");
    expect(inlineToPlainText("Year {event:year}", event)).toBe("Year 2026");
    expect(inlineToPlainText("At {event:scheduledAt}", event)).toBe(
      `At ${formatStamp(event.scheduledAt)}`
    );
  });

  it("leaves the event placeholders blank without an event", () => {
    expect(
      inlineToPlainText("{event:name}|{event:year}|{event:scheduledAt}", null)
    ).toBe("||");
  });

  it("leaves a year blank when the event has none", () => {
    expect(
      inlineToPlainText("{event:year}", { ...event, year: null })
    ).toBe("");
  });

  it("leaves unknown braces literal", () => {
    expect(inlineToPlainText("{event:other}", event)).toBe("{event:other}");
  });
});
