import { get } from "../client";
import type { AuditEntry, Page } from "../types";

// Known verbs. Kept in step with contracts 4.5 by hand; adding a verb
// here is a one-line change that shows up in the /audit filter.
export const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "activate",
  "deactivate",
  "revoke",
  "rotate",
  "publish",
  "restore",
  "reorder",
  "duplicate",
  "move",
  "hide",
  "unhide",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditQuery = {
  entity?: string;
  entityId?: string;
  action?: string;
  actor?: string;
  cursor?: string;
  limit?: number;
};

export const audit = {
  list: (q: AuditQuery = {}) => get<Page<AuditEntry>>("/admin/audit", q),
  entities: () => get<{ items: string[] }>("/admin/audit/entities"),
};
