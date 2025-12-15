import { AxiosInstance } from "axios";
import { ISponsor, ISponsorLogo } from "../interfaces";

export const createSponsorsApi = (c: AxiosInstance) => ({
  getAll: () => c.get<ISponsor[]>("/sponsors"),
  getById: (id: number) => c.get<ISponsor>(`/sponsors/${id}`),

  create: (data: Partial<ISponsor>) => c.post<ISponsor>("/sponsors", data),

  update: (id: number, data: Partial<ISponsor>) =>
    c.patch<ISponsor>(`/sponsors/${id}`, data),

  delete: (id: number) => c.delete<void>(`/sponsors/${id}`),

  // uploadLogo: (id: number, file: File) => {
  //   const fd = new FormData();
  //   fd.append("logo", file);
  //   return c.upload<void>(`/sponsors/${id}/logo`, fd);
  // },

  listLogos: (id: number) => c.get<ISponsorLogo>(`/sponsors/${id}/logo`),

  deleteLogos: (id: number) => c.delete<void>(`/sponsors/${id}/logo`),
});
