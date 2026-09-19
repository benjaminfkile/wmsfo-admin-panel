import { get } from "../client";
import type { EmailQuota } from "../types";

export const email = {
  quota: () => get<EmailQuota>("/admin/email/quota"),
};
