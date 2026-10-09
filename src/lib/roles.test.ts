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

  it("puts the Poster studio right after Media for admin only", () => {
    expect(ADMIN_NAV[ADMIN_NAV.indexOf("media") + 1]).toBe("posters");
    expect(EDITOR_NAV).not.toContain("posters");
    expect(CANVASSER_NAV).not.toContain("posters");
  });

  it("puts Maps and Tracker themes right after Flight recordings for admin only", () => {
    const routesAt = ADMIN_NAV.indexOf("routes");
    expect(ADMIN_NAV[routesAt + 1]).toBe("maps");
    expect(ADMIN_NAV[routesAt + 2]).toBe("themes");
    expect(ADMIN_NAV[routesAt + 3]).toBe("beacons");
    expect(EDITOR_NAV).not.toContain("maps");
    expect(EDITOR_NAV).not.toContain("themes");
    expect(CANVASSER_NAV).not.toContain("maps");
    expect(CANVASSER_NAV).not.toContain("themes");
    expect(canAccess("admin", "maps")).toBe(true);
    expect(canAccess("admin", "themes")).toBe(true);
    expect(canAccess("editor", "maps")).toBe(false);
    expect(canAccess("editor", "themes")).toBe(false);
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
