import type { SignupBlock } from "../../api/types";

export type BlockKind = "address" | "domain";

// The pattern rules of contracts 4.5 People: an address, or a domain
// written as `*@<domain>`, 3 to 254 characters, trimmed and lowercased.
const ADDRESS_RE = /^[^\s@*]+@[^\s@*]+\.[^\s@*]+$/;
const DOMAIN_RE = /^\*@[^\s@*]+\.[^\s@*]+$/;
export const NOTE_MAX = 300;
export const IMPACT_DEBOUNCE_MS = 400;

// The pattern the API is sent for what was typed. A domain is typed
// without the `*@`; one typed with it (or with a bare `@`) is accepted.
export function toPattern(kind: BlockKind, text: string): string {
  const t = text.trim().toLowerCase();
  if (kind === "address") return t;
  return `*@${t.replace(/^\*?@/, "")}`;
}

export function patternValid(kind: BlockKind, pattern: string): boolean {
  if (pattern.length < 3 || pattern.length > 254) return false;
  return (kind === "address" ? ADDRESS_RE : DOMAIN_RE).test(pattern);
}

export function accounts(n: number): string {
  return n === 1 ? "1 account" : `${n} accounts`;
}

// The person delete removes the sign-in too (contracts 4.5 People);
// the impact preview lists only the rows.
export const PERSON_DELETE_NOTE =
  "Their sign-in is removed and they are signed out everywhere; they can create a new account afterwards.";

// A domain block reads as the people it covers, an address as itself.
export function blockLabel(b: SignupBlock): string {
  const p = b.pattern ?? "";
  return b.kind === "domain" || p.startsWith("*@")
    ? `anyone at ${p.replace(/^\*@/, "")}`
    : p;
}
