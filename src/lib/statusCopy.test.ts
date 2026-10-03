import { describe, expect, it } from "vitest";
import { stockParagraph } from "./statusCopy";
import { formatStamp } from "./time";

describe("stockParagraph", () => {
  it("returns a distinct paragraph per status id", () => {
    const name = "Santa Flyover 2027";
    const p1 = stockParagraph(1, name, null);
    const p2 = stockParagraph(2, name, "2027-12-24T02:00:00.000Z");
    const p3 = stockParagraph(3, name, null);
    const p4 = stockParagraph(4, name, null);
    const p5 = stockParagraph(5, name, null);
    const p6 = stockParagraph(6, name, null);
    for (const p of [p1, p2, p3, p4, p5, p6]) {
      expect(p).toContain(name);
    }
    expect(new Set([p1, p2, p3, p4, p5, p6]).size).toBe(6);
  });

  it("scheduled paragraph mentions the scheduledAt when set", () => {
    const withTime = stockParagraph(2, "Santa Flyover 2027", "2027-12-24T02:00:00.000Z");
    const withoutTime = stockParagraph(2, "Santa Flyover 2027", null);
    expect(withTime).toMatch(/Lift-off is planned for/);
    expect(withoutTime).not.toMatch(/Lift-off is planned for/);
  });

  it("scheduled paragraph carries the stamp with its zone and no Mountain time", () => {
    const at = "2027-12-24T02:00:00.000Z";
    const p = stockParagraph(2, "Santa Flyover 2027", at);
    expect(p).toContain(`Lift-off is planned for ${formatStamp(at)}.`);
    expect(p).not.toContain("Mountain time");
    expect(p).not.toContain("Mountain");
  });

  it("postponed paragraph says a new time will be announced", () => {
    expect(stockParagraph(6, "Santa Flyover 2027", null)).toBe(
      "Santa Flyover 2027 is postponed. A new time will be announced when it is known."
    );
  });
});
