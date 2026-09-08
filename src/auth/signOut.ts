import type { UserManager } from "oidc-client-ts";
import type { Config } from "../config";

export async function signOut(um: UserManager, c: Config): Promise<void> {
  await um.revokeTokens(["refresh_token"]).catch(() => undefined);
  await um.removeUser();
  const url = new URL(`${c.cognitoDomain}/logout`);
  url.searchParams.set("client_id", c.cognitoClientId);
  url.searchParams.set("logout_uri", `${window.location.origin}/`);
  window.location.assign(url.toString());
}
