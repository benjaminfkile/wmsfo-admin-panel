import type { User } from "oidc-client-ts";

export const ADMIN_GROUP = "admin";
export const EDITOR_GROUP = "editor";
export type Role = "admin" | "editor";

export function roleOf(user: User): Role | null {
  const groups = user.profile["cognito:groups"];
  if (!Array.isArray(groups)) return null;
  if (groups.includes(ADMIN_GROUP)) return "admin";
  if (groups.includes(EDITOR_GROUP)) return "editor";
  return null;
}

export function emailOf(user: User): string {
  return typeof user.profile.email === "string" ? user.profile.email : "";
}
