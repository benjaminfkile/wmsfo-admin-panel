import { describe, expect, it } from "vitest";
import { STATUS_IDS, STATUS_NAMES, statusName } from "./statusNames";

describe("statusName", () => {
  it("names status 6 Postponed", () => {
    expect(statusName(6)).toBe("Postponed");
  });

  it("lists Postponed after Cancelled", () => {
    expect(STATUS_IDS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(STATUS_IDS.map((id) => STATUS_NAMES[id])).toEqual([
      "Planned",
      "Scheduled",
      "Live",
      "Ended",
      "Cancelled",
      "Postponed",
    ]);
  });

  it("returns the number for an unknown id and an empty string for none", () => {
    expect(statusName(7)).toBe("7");
    expect(statusName(null)).toBe("");
  });
});
