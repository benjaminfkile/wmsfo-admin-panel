import { AxiosInstance } from "axios";

export const createLocationApi = (c: AxiosInstance) => ({
  get: async () => {
    const res = await c.get("/api/location");
    return res.data;
  },
});
