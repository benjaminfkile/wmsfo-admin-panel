import { AxiosInstance } from "axios";

export const createEventUpdatesApi = (c: AxiosInstance) => ({
  getLatest() {
    return c
      .get("/api/event-updates/latest", { requiresPrefix: true })
      .then((res) => res.data);
  },

  post(payload: { message: string; time?: string }) {
    return c.post("/api/event-updates/post", payload, {
      requiresPrefix: true,
    });
  },
});
