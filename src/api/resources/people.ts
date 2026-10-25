import { del, get, post } from "../client";
import type { Page, Person, SignupBlock, SignupBlockImpact } from "../types";

export type SignupBlockCreateBody = { pattern: string; note: string };

export const people = {
  list: (q: { cursor?: string; limit?: number }) =>
    get<Page<Person & { cookieCount: number }>>("/admin/people", q),
  remove: (id: number) => del(`/admin/people/${id}`),
  // Blocked addresses and domains (contracts 4.5 People). A block
  // removes every account it matches in the same write.
  blocks: {
    list: () => get<{ items: SignupBlock[] }>("/admin/people/blocks"),
    impact: (pattern: string) =>
      get<SignupBlockImpact>("/admin/people/blocks/impact", { pattern }),
    create: (b: SignupBlockCreateBody) =>
      post<SignupBlock>("/admin/people/blocks", b),
    remove: (id: number) => del(`/admin/people/blocks/${id}`),
  },
};
