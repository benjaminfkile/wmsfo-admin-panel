export type AppEnv = "prod" | "dev" | "local";
export type Config = {
  env: AppEnv;
  apiBaseUrl: string;
  cdnBaseUrl: string;
  cognitoAuthority: string;
  cognitoDomain: string;
  cognitoClientId: string;
};

const NAMES = [
  "VITE_ENV",
  "VITE_API_BASE_URL",
  "VITE_CDN_BASE_URL",
  "VITE_COGNITO_AUTHORITY",
  "VITE_COGNITO_DOMAIN",
  "VITE_COGNITO_CLIENT_ID",
] as const;

export type ConfigResult = { config: Config } | { missing: string[] };

export function loadConfig(env: ImportMetaEnv = import.meta.env): ConfigResult {
  const missing: string[] = NAMES.filter((n) => {
    const v = env[n];
    return typeof v !== "string" || v.trim() === "";
  });
  if (!["prod", "dev", "local"].includes(env.VITE_ENV)) {
    missing.push("VITE_ENV (must be prod, dev, or local)");
  }
  if (missing.length > 0) return { missing };
  const strip = (s: string) => s.replace(/\/+$/, "");
  return {
    config: {
      env: env.VITE_ENV as AppEnv,
      apiBaseUrl: strip(env.VITE_API_BASE_URL),
      cdnBaseUrl: strip(env.VITE_CDN_BASE_URL),
      cognitoAuthority: strip(env.VITE_COGNITO_AUTHORITY),
      cognitoDomain: strip(env.VITE_COGNITO_DOMAIN),
      cognitoClientId: env.VITE_COGNITO_CLIENT_ID,
    },
  };
}
