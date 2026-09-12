import type { Role } from "../auth/claims";

export type NavKey =
  | "dashboard"
  | "events"
  | "routes"
  | "beacons"
  | "pages"
  | "media"
  | "site-settings"
  | "publish"
  | "sponsors"
  | "sponsors-order"
  | "cookie-types"
  | "cookies"
  | "subscribers"
  | "people"
  | "contact-messages"
  | "settings"
  | "api-keys";

export const ADMIN_NAV: NavKey[] = [
  "dashboard",
  "events",
  "routes",
  "beacons",
  "pages",
  "media",
  "site-settings",
  "publish",
  "sponsors",
  "sponsors-order",
  "cookie-types",
  "cookies",
  "subscribers",
  "people",
  "contact-messages",
  "settings",
  "api-keys",
];

export const EDITOR_NAV: NavKey[] = [
  "pages",
  "media",
  "site-settings",
  "publish",
  "sponsors",
  "sponsors-order",
];

export function navFor(role: Role): NavKey[] {
  return role === "admin" ? ADMIN_NAV : EDITOR_NAV;
}

export function canAccess(role: Role, key: NavKey): boolean {
  return navFor(role).includes(key);
}

export function landingFor(role: Role): string {
  return role === "admin" ? "/" : "/pages";
}
