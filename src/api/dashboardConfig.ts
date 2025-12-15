import { AxiosInstance } from "axios";
import { IDashboardConfigResponse } from "../interfaces";

export const createDashboardConfigApi = (c: AxiosInstance) => ({
  get: () =>
    c.get<IDashboardConfigResponse>("/api/dashboard-config").then(r => r.data),
});
