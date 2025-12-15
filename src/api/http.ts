import { axiosClient } from "./axiosClient";

export function get<T>(url: string) {
  return axiosClient.get<T>(url).then((r) => r.data);
}

export function post<T>(url: string, body?: unknown) {
  return axiosClient.post<T>(url, body).then((r) => r.data);
}

export function patch<T>(url: string, body?: unknown) {
  return axiosClient.patch<T>(url, body).then((r) => r.data);
}

export function del<T>(url: string) {
  return axiosClient.delete<T>(url).then((r) => r.data);
}
