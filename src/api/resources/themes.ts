import { get, patch, post, request } from "../client";
import type { SpriteTickets, TrackerTheme } from "../types";

export type Chrome = {
  bg: string;
  fg: string;
  text: string;
  tile: string;
  tileFg: string;
  panel: string;
  accent: string;
};

export type Overlay = {
  routeColor: string;
  routeOpacity: number;
  arrowColor: string;
  timeLabelBg: string;
  timeLabelFg: string;
  timeLabelOpacity: number;
  userColor: string;
};

export type ThemeBody = {
  renderer: "google" | "maplibre";
  key: string;
  name: string;
  sortOrder: number;
  style: unknown;
  chrome: Chrome;
  overlay: Overlay;
  thumbnailMediaId: string | null;
};

// Tracker themes (admin.md 6.28). The sprite calls carry the SHA-256 of
// the sprite.json about to be uploaded, which names the object prefix.
export const themes = {
  list: () => get<{ items: TrackerTheme[] }>("/admin/themes"),
  create: (b: ThemeBody) => post<TrackerTheme>("/admin/themes", b),
  patch: (id: number, b: Partial<Omit<ThemeBody, "renderer">>) =>
    patch<TrackerTheme>(`/admin/themes/${id}`, b),
  spriteTickets: (id: number, indexSha256: string) =>
    post<SpriteTickets>(`/admin/themes/${id}/sprite`, { indexSha256 }),
  confirmSprite: (id: number, indexSha256: string) =>
    post<TrackerTheme>(`/admin/themes/${id}/sprite/confirm`, { indexSha256 }),
  setDefault: (id: number, b: { light?: boolean; dark?: boolean }) =>
    post<TrackerTheme>(`/admin/themes/${id}/default`, b),
  remove: (id: number, replacementId: number | null) =>
    request<void>({
      method: "DELETE",
      path: `/admin/themes/${id}`,
      json: replacementId == null ? undefined : { replacementId },
      parse: "none",
    }),
};
