import { get, post, put } from "../client";
import type { HelpLink, HelpTopic } from "../types";

export type HelpTopicBody = {
  title: string;
  body: string;
  links: HelpLink[];
};

export const help = {
  list: () => get<{ items: HelpTopic[] }>("/admin/help"),
  put: (key: string, b: HelpTopicBody) =>
    put<HelpTopic>(`/admin/help/${encodeURIComponent(key)}`, b),
  reset: (key: string) =>
    post<HelpTopic>(`/admin/help/${encodeURIComponent(key)}/reset`),
};
