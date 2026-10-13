import { describe, expect, it } from "vitest";
import { stockParagraph } from "./statusCopy";

describe("stockParagraph", () => {
  it("returns a distinct paragraph per status id", () => {
    const name = "Santa Flyover 2027";
    const ps = ([1, 2, 3, 4, 5, 6] as const).map((id) => stockParagraph(id, name));
    for (const p of ps) {
      expect(p).toContain(name);
    }
    expect(new Set(ps).size).toBe(6);
  });

  it("scheduled paragraph names the event and carries no time", () => {
    expect(stockParagraph(2, "Santa Flyover 2027")).toBe("Santa Flyover 2027 is scheduled.");
  });

  it("scheduled paragraph is the same whether or not the event has a scheduled time", () => {
    const withTime = { name: "Santa Flyover 2027", scheduledAt: "2027-12-24T02:00:00.000Z" };
    const withoutTime = { name: "Santa Flyover 2027", scheduledAt: null };
    expect(stockParagraph(2, withTime.name)).toBe("Santa Flyover 2027 is scheduled.");
    expect(stockParagraph(2, withoutTime.name)).toBe("Santa Flyover 2027 is scheduled.");
  });

  it("postponed paragraph says a new time will be announced", () => {
    expect(stockParagraph(6, "Santa Flyover 2027")).toBe(
      "Santa Flyover 2027 is postponed. A new time will be announced when it is known."
    );
  });
});
