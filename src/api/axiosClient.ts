import axios, {
  InternalAxiosRequestConfig,
} from "axios";
import { getApiKey } from "../auth/apiKey";
import { getProtectedRoutePrefix } from "../auth/runtimeConfig";

declare module "axios" {
  export interface AxiosRequestConfig {
    requiresPrefix?: boolean;
  }

  export interface InternalAxiosRequestConfig {
    requiresPrefix?: boolean;
  }
}

export const axiosClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL, 
});

axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const apiKey = getApiKey();
    const prefix = getProtectedRoutePrefix();

    if (apiKey) {
      config.headers.set("x-wmsfo-key", apiKey);
    }

    if (config.requiresPrefix) {
      if (!prefix) {
        throw new Error("Protected route prefix not initialized");
      }

      config.url = config.url!.replace(
        /^\/api/,
        `/api/${prefix}`
      );
    }

    return config;
  }
);
