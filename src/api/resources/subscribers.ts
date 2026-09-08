import { del, get } from "../client";
import type { Page, SubscriberAdmin } from "../types";

export type SubscriberStatus = "verified" | "pending" | "unsubscribed";

export const subscribers = {
  summary: () =>
    get<{ verified: number; pending: number; unsubscribed: number }>(
      "/admin/subscribers/summary"
    ),
  list: (q: { cursor?: string; limit?: number; status?: SubscriberStatus }) =>
    get<Page<SubscriberAdmin>>("/admin/subscribers", q),
  remove: (id: number) => del(`/admin/subscribers/${id}`),
};
