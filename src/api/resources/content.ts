import { get, post } from "../client";
import type {
  ContentBundle,
  ContentStatus,
  ContentVersionInfo,
  KindInfo,
  PreviewToken,
} from "../types";

export const content = {
  kinds: () => get<{ items: KindInfo[] }>("/admin/content/kinds"),
  status: () => get<ContentStatus>("/admin/content/status"),
  draft: () => get<ContentBundle>("/admin/content/draft"),
  publish: (label: string | null) =>
    post<ContentVersionInfo>("/admin/content/publish", { label }),
  versions: () =>
    get<{ items: ContentVersionInfo[] }>("/admin/content/versions"),
  version: (id: number) =>
    get<ContentVersionInfo & { document: object }>(
      `/admin/content/versions/${id}`
    ),
  restore: (id: number) =>
    post<ContentStatus>(`/admin/content/versions/${id}/restore`),
  previewToken: () => post<PreviewToken>("/admin/content/preview-token"),
};
