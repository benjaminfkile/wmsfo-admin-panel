import type { NavKey } from "./lib/roles";

export type RouteDef = {
  key: NavKey;
  path: string;
  label: string;
};

export const ALL_ROUTES: RouteDef[] = [
  { key: "dashboard", path: "/", label: "Dashboard" },
  { key: "events", path: "/events", label: "Events" },
  { key: "routes", path: "/routes", label: "Flight recordings" },
  { key: "beacons", path: "/beacons", label: "Beacons" },
  { key: "pages", path: "/pages", label: "Pages" },
  { key: "media", path: "/media", label: "Media" },
  { key: "site-settings", path: "/site-settings", label: "Site settings" },
  { key: "publish", path: "/publish", label: "Publish" },
  { key: "sponsors", path: "/sponsors", label: "Sponsors" },
  { key: "sponsors-order", path: "/sponsors/order", label: "Sponsor order" },
  { key: "cookie-types", path: "/cookie-types", label: "Cookie types" },
  { key: "cookies", path: "/cookies", label: "Cookies" },
  { key: "subscribers", path: "/subscribers", label: "Subscribers" },
  { key: "people", path: "/people", label: "People" },
  { key: "contact-messages", path: "/contact-messages", label: "Contact messages" },
  { key: "settings", path: "/settings", label: "Settings" },
  { key: "api-keys", path: "/api-keys", label: "API keys" },
  { key: "agents", path: "/agents", label: "Agents" },
];
