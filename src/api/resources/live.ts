import { get, post } from "../client";
import type { LiveObject, LiveState } from "../types";

export const live = {
  get: () => get<LiveState>("/admin/live"),
  republish: () => post<LiveObject>("/admin/live/republish"),
};
