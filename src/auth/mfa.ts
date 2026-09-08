import type { Config } from "../config";

type IdPTarget =
  | "AssociateSoftwareToken"
  | "VerifySoftwareToken"
  | "SetUserMFAPreference";

async function idp<T>(config: Config, target: IdPTarget, body: unknown): Promise<T> {
  const res = await fetch(`${new URL(config.cognitoAuthority).origin}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(parsed?.message ?? `IdP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const associate = (config: Config, accessToken: string) =>
  idp<{ SecretCode: string }>(config, "AssociateSoftwareToken", { AccessToken: accessToken });

export const verify = (config: Config, accessToken: string, code: string) =>
  idp<{ Status: "SUCCESS" | "ERROR" }>(config, "VerifySoftwareToken", {
    AccessToken: accessToken,
    UserCode: code,
    FriendlyDeviceName: "WMSFO admin",
  });

export const prefer = (config: Config, accessToken: string) =>
  idp<Record<string, never>>(config, "SetUserMFAPreference", {
    AccessToken: accessToken,
    SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
  });

export function otpauthUri(secret: string, email: string): string {
  const issuer = "WMSFO Admin";
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({ secret, issuer });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
