import type { User } from "oidc-client-ts";

export const ADMIN_GROUP = "admin";
export const EDITOR_GROUP = "editor";
export const CANVASSER_GROUP = "canvasser";
export type Role = "admin" | "editor" | "canvasser";

export function roleOf(user: User): Role | null {
  const groups = user.profile["cognito:groups"];
  if (!Array.isArray(groups)) return null;
  if (groups.includes(ADMIN_GROUP)) return "admin";
  if (groups.includes(EDITOR_GROUP)) return "editor";
  if (groups.includes(CANVASSER_GROUP)) return "canvasser";
  return null;
}

export function emailOf(user: User): string {
  return typeof user.profile.email === "string" ? user.profile.email : "";
}
