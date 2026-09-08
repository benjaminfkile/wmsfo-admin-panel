import type { UserManager } from "oidc-client-ts";
import type { Config } from "../config";
import { ApiError, AuthRequired, NetworkError } from "./errors";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Query = Record<string, string | number | boolean | undefined>;
type Req = {
  method: Method;
  path: string;
  query?: Query;
  json?: unknown;
  form?: FormData;
  accept?: string;
  parse?: "json" | "text" | "blob" | "none";
};

type ClientDeps = {
  config: Config;
  userManager: UserManager;
  onMfaRequired: () => void;
};

let deps: ClientDeps | null = null;

export function installClient(d: ClientDeps): void {
  deps = d;
}

function need(): ClientDeps {
  if (!deps) throw new Error("API client not installed");
  return deps;
}

export async function idToken(): Promise<string> {
  const { userManager } = need();
  let user = await userManager.getUser();
  if (!user || user.expired) {
    user = await userManager.signinSilent();
  }
  if (!user?.id_token) throw new AuthRequired();
  return user.id_token;
}

export async function request<T>(req: Req): Promise<T> {
  const { config, userManager, onMfaRequired } = need();
  const url = new URL(config.apiBaseUrl + req.path);
  for (const [k, v] of Object.entries(req.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const send = (token: string) =>
    fetch(url, {
      method: req.method,
      credentials: "omit",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(req.json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(req.accept ? { Accept: req.accept } : {}),
      },
      body: req.json !== undefined ? JSON.stringify(req.json) : req.form,
    });

  let res: Response;
  try {
    res = await send(await idToken());
    if (res.status === 401) {
      const renewed = await userManager.signinSilent().catch(() => null);
      if (!renewed?.id_token) throw new AuthRequired();
      res = await send(renewed.id_token);
      if (res.status === 401) throw new AuthRequired();
    }
  } catch (e) {
    if (e instanceof TypeError) throw new NetworkError(e.message);
    throw e;
  }

  if (!res.ok) {
    const body =
      res.status === 405
        ? null
        : ((await res.json().catch(() => null)) as ApiError["body"] | null);
    const err = new ApiError(res.status, body);
    if (err.code === "mfa_required") onMfaRequired();
    throw err;
  }

  switch (req.parse ?? "json") {
    case "none":
      return undefined as T;
    case "text":
      return (await res.text()) as T;
    case "blob":
      return (await res.blob()) as T;
    default:
      return (res.status === 204 ? undefined : await res.json()) as T;
  }
}

export const get = <T>(path: string, query?: Query) =>
  request<T>({ method: "GET", path, query });
export const post = <T>(path: string, json?: unknown) =>
  request<T>({ method: "POST", path, json });
export const patch = <T>(path: string, json: unknown) =>
  request<T>({ method: "PATCH", path, json });
export const put = <T>(path: string, json: unknown) =>
  request<T>({ method: "PUT", path, json });
export const putForm = <T>(path: string, form: FormData) =>
  request<T>({ method: "PUT", path, form });
export const del = (path: string) =>
  request<void>({ method: "DELETE", path, parse: "none" });
