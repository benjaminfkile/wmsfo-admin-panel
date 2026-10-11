import { describe, expect, it } from "vitest";
import { statusRoleLabel } from "./statusRoleLabel";

describe("statusRoleLabel", () => {
  it("names the no_event role as the Off season page", () => {
    expect(statusRoleLabel("no_event")).toBe("Off season (no current event)");
  });

  it("names the status roles by their status", () => {
    expect(statusRoleLabel("live")).toBe("Live");
    expect(statusRoleLabel("postponed")).toBe("Postponed");
  });
});
