import { AxiosInstance } from "axios";
import { IEventModeOverride } from "../interfaces";

export const createEventModeOverrideApi = (c: AxiosInstance) => ({
  /**
   * GET /api/{prefix}/event-mode-override/active
   */
  getActive(): Promise<IEventModeOverride> {
    return c
      .get<IEventModeOverride>("/api/event-mode-override/active", {
        requiresPrefix: true,
      })
      .then((res) => res.data);
  },

  /**
   * POST /api/{prefix}/event-mode-override/set
   * Body: { mode, expires_at }
   */
  set(payload: {
    mode: number;
    expires_at: string;
  }): Promise<{ message: string; data: IEventModeOverride }> {
    return c
      .post<{ message: string; data: IEventModeOverride }>(
        "/api/event-mode-override/set",
        payload,
        { requiresPrefix: true }
      )
      .then((res) => res.data);
  },

  /**
   * POST /api/{prefix}/event-mode-override/expire-all
   */
  expireAll(): Promise<{ message: string }> {
    return c
      .post<{ message: string }>(
        "/api/event-mode-override/expire-all",
        null,
        { requiresPrefix: true }
      )
      .then((res) => res.data);
  },
});
