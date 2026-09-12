import { get, post } from "../client";
import type { ApiKey, ApiKeyCapability, ApiKeyMinted } from "../types";

export type ApiKeyCreateBody = {
  name: string;
  allCapabilities: boolean;
  capabilities: ApiKeyCapability[];
  expiresAt: string | null;
};

export const apiKeys = {
  list: () => get<{ items: ApiKey[] }>("/admin/api-keys"),
  create: (b: ApiKeyCreateBody) =>
    post<ApiKeyMinted>("/admin/api-keys", b),
  revoke: (id: number) => post<ApiKey>(`/admin/api-keys/${id}/revoke`),
};
