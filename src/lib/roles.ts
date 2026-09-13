import type { Role } from "../auth/claims";

export type NavKey =
  | "dashboard"
  | "events"
  | "routes"
  | "beacons"
  | "qr-codes"
  | "places"
  | "scan"
  | "pages"
  | "media"
  | "site-settings"
  | "publish"
  | "sponsors"
  | "sponsors-order"
  | "cookie-types"
  | "subscribers"
  | "people"
  | "contact-messages"
  | "settings"
  | "api-keys"
  | "agents"
  | "audit";

// Drawer order per admin.md 6.1: admin sees QR codes, Places, and Scan
// after Beacons; editor gets them beside content; canvasser sees only
// those three and lands on Scan.
export const ADMIN_NAV: NavKey[] = [
  "dashboard",
  "events",
  "routes",
  "beacons",
  "qr-codes",
  "places",
  "scan",
  "pages",
  "media",
  "site-settings",
  "publish",
  "sponsors",
  "sponsors-order",
  "cookie-types",
  "subscribers",
  "people",
  "contact-messages",
  "settings",
  "api-keys",
  "agents",
  "audit",
];

export const EDITOR_NAV: NavKey[] = [
  "pages",
  "media",
  "site-settings",
  "publish",
  "sponsors",
  "sponsors-order",
  "qr-codes",
  "places",
  "scan",
  "audit",
];

export const CANVASSER_NAV: NavKey[] = ["qr-codes", "places", "scan"];

export function navFor(role: Role): NavKey[] {
  switch (role) {
    case "admin":
      return ADMIN_NAV;
    case "editor":
      return EDITOR_NAV;
    case "canvasser":
      return CANVASSER_NAV;
  }
}

export function canAccess(role: Role, key: NavKey): boolean {
  return navFor(role).includes(key);
}

export function landingFor(role: Role): string {
  if (role === "canvasser") return "/scan";
  return role === "admin" ? "/" : "/pages";
}
