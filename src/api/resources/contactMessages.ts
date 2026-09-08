import { del, get } from "../client";
import type { ContactMessage, Page } from "../types";

export const contactMessages = {
  list: (q: { cursor?: string; limit?: number }) =>
    get<Page<ContactMessage>>("/admin/contact-messages", q),
  remove: (id: number) => del(`/admin/contact-messages/${id}`),
};
