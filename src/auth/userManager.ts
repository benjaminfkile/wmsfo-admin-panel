import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import type { Config } from "../config";

export const SCOPE = "openid email profile aws.cognito.signin.user.admin";

export function createUserManager(c: Config): UserManager {
  return new UserManager({
    authority: c.cognitoAuthority,
    client_id: c.cognitoClientId,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: "code",
    scope: SCOPE,
    automaticSilentRenew: true,
    accessTokenExpiringNotificationTimeInSeconds: 120,
    monitorSession: false,
    loadUserInfo: false,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });
}
