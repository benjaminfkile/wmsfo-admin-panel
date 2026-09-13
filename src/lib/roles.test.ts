// admin.md 6.1: drawer entries per role, and the canvasser's landing
// page. Kept here so a future drawer rearrangement fails a test.

import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  CANVASSER_NAV,
  EDITOR_NAV,
  canAccess,
  landingFor,
  navFor,
} from "./roles";

describe("navFor", () => {
  it("puts QR codes, Places, and Scan right after Beacons for admin", () => {
    const beaconsAt = ADMIN_NAV.indexOf("beacons");
    expect(ADMIN_NAV[beaconsAt + 1]).toBe("qr-codes");
    expect(ADMIN_NAV[beaconsAt + 2]).toBe("places");
    expect(ADMIN_NAV[beaconsAt + 3]).toBe("scan");
  });

  it("gives the editor QR codes, Places, and Scan alongside content", () => {
    expect(EDITOR_NAV).toContain("qr-codes");
    expect(EDITOR_NAV).toContain("places");
    expect(EDITOR_NAV).toContain("scan");
  });

  it("gives the canvasser only those three entries", () => {
    expect(CANVASSER_NAV).toEqual(["qr-codes", "places", "scan"]);
    expect(navFor("canvasser")).toEqual(CANVASSER_NAV);
  });

  it("canAccess mirrors the drawer for every role", () => {
    expect(canAccess("canvasser", "scan")).toBe(true);
    expect(canAccess("canvasser", "events")).toBe(false);
    expect(canAccess("editor", "qr-codes")).toBe(true);
    expect(canAccess("editor", "events")).toBe(false);
    expect(canAccess("admin", "qr-codes")).toBe(true);
  });

  it("lands the canvasser on Scan", () => {
    expect(landingFor("canvasser")).toBe("/scan");
    expect(landingFor("admin")).toBe("/");
    expect(landingFor("editor")).toBe("/pages");
  });
});
