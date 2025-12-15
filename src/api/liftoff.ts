import { AxiosInstance } from "axios";
import { ILiftoff } from "../interfaces";

export const createLiftoffApi = (c: AxiosInstance) => ({
  get: () => c.get<ILiftoff | null>("/liftoff"),
  post: () => c.post<ILiftoff>("/liftoff"),
});
