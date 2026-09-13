import { formatMt } from "../../lib/time";
import type { AuditEntry, AuditStamp } from "../../api/types";

// "person:foo@bar" -> "foo@bar"; "key:my-key" -> "key my-key";
// anything else passes through unchanged.
export function formatActor(actor: string | null | undefined): string {
  if (!actor) return "unknown";
  if (actor.startsWith("person:")) return actor.slice("person:".length);
  if (actor.startsWith("key:")) return `key ${actor.slice("key:".length)}`;
  return actor;
}

const CAPITALIZE = new Map<string, string>([
  ["create", "Create"],
  ["update", "Update"],
  ["delete", "Delete"],
  ["activate", "Activate"],
  ["deactivate", "Deactivate"],
  ["revoke", "Revoke"],
  ["rotate", "Rotate"],
  ["publish", "Publish"],
  ["restore", "Restore"],
  ["reorder", "Reorder"],
  ["duplicate", "Duplicate"],
  ["move", "Move"],
  ["hide", "Hide"],
  ["unhide", "Unhide"],
]);

export function formatAction(action: string | null | undefined): string {
  if (!action) return "";
  return CAPITALIZE.get(action) ?? (action.slice(0, 1).toUpperCase() + action.slice(1));
}

// The stamp text on the audit icon's tooltip and used in the /audit
// list. When the row has never been touched, returns the fallback.
export function stampText(audit: AuditStamp | null | undefined): string {
  if (!audit) return "No changes recorded since the audit log began";
  const action = formatAction(audit.action);
  const actor = formatActor(audit.by);
  const at = formatMt(audit.at);
  return `${action} by ${actor} · ${at}`;
}

type Diff = {
  field: string;
  before: unknown;
  after: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function shallow(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v) || isPlainObject(v)) return "changed";
  return v;
}

// Compare two JSON objects (the raw before and after on an audit
// entry) and return the top-level fields that differ, each summarised
// to a scalar or the string "changed" when it is an array or object.
export function diffFields(before: unknown, after: unknown): Diff[] {
  const b = isPlainObject(before) ? before : {};
  const a = isPlainObject(after) ? after : {};
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);
  const out: Diff[] = [];
  for (const k of Array.from(keys).sort()) {
    const bv = (b as Record<string, unknown>)[k];
    const av = (a as Record<string, unknown>)[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      out.push({ field: k, before: shallow(bv), after: shallow(av) });
    }
  }
  return out;
}

export function formatDiffValue(v: unknown): string {
  if (v === undefined) return "(unset)";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function summariseEntry(entry: AuditEntry): string {
  const diffs = diffFields(entry.before ?? null, entry.after ?? null);
  if (diffs.length === 0) {
    if (entry.action === "delete") return "(row deleted)";
    if (entry.action === "create") return "(row created)";
    return "(no changes)";
  }
  return diffs
    .map((d) => `${d.field}: ${formatDiffValue(d.before)} → ${formatDiffValue(d.after)}`)
    .join(", ");
}
