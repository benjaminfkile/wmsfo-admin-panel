import { AxiosInstance } from "axios";
import { IFund } from "../interfaces";

export const createFundsApi = (c: AxiosInstance) => ({
  get(): Promise<IFund> {
    return c
      .get<IFund>("/api/funds-status", { requiresPrefix: true })
      .then((res) => res.data);
  },

  set(percent: number): Promise<void> {
    return c.post(
      "/api/funds-status",
      { percent },             
      { requiresPrefix: true }    
    );
  },
});
