import { del, get } from "../client";
import type { Page, Person } from "../types";

export const people = {
  list: (q: { cursor?: string; limit?: number }) =>
    get<Page<Person & { cookieCount: number }>>("/admin/people", q),
  remove: (id: number) => del(`/admin/people/${id}`),
};
