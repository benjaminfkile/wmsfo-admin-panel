import { AxiosInstance } from "axios";
import { ITrackiDevice } from "../interfaces";

export const createTrackiDeviceApi = (c: AxiosInstance) => ({
  getAll: () => c.get<ITrackiDevice[]>("/tracki-device"),
  getById: (id: number) => c.get<ITrackiDevice>(`/tracki-device/${id}`),
  getActive: () => c.get<ITrackiDevice>("/tracki-device/active"),

  create: (device: Omit<ITrackiDevice, "id" | "created_at">) =>
    c.post<ITrackiDevice>("/tracki-device", device),

  activate: (id: number) => c.patch<void>(`/tracki-device/${id}/activate`),

  deactivate: (id: number) => c.patch<void>(`/tracki-device/${id}/deactivate`),

  delete: (id: number) => c.delete<void>(`/tracki-device/${id}`),
});
