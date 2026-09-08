import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User, UserManager } from "oidc-client-ts";
import { emailOf, roleOf, type Role } from "./claims";

export type AuthState =
  | { kind: "loading" }
  | { kind: "signed_out"; returnTo: string }
  | { kind: "no_role"; email: string }
  | { kind: "mfa_required"; email: string }
  | { kind: "member"; email: string; role: Role };

export type AuthContextValue = {
  state: AuthState;
  userManager: UserManager;
  requireMfa: () => void;
  reset: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function evaluate(user: User): AuthState {
  const role = roleOf(user);
  const email = emailOf(user);
  if (role === null) return { kind: "no_role", email };
  return { kind: "member", email, role };
}

function currentReturnTo(): string {
  return window.location.pathname + window.location.search;
}

interface Props {
  userManager: UserManager;
  children: ReactNode;
}

export default function AuthProvider({ userManager, children }: Props) {
  const [state, setState] = useState<AuthState>({ kind: "loading" });
  const stateRef = useRef<AuthState>(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    const setIfLive = (s: AuthState) => {
      if (!cancelled) setState(s);
    };

    (async () => {
      try {
        let user = await userManager.getUser();
        if (user === null) {
          setIfLive({ kind: "signed_out", returnTo: currentReturnTo() });
          return;
        }
        if (user.expired && user.refresh_token) {
          try {
            const renewed = await userManager.signinSilent();
            if (renewed) user = renewed;
          } catch {
            setIfLive({ kind: "signed_out", returnTo: currentReturnTo() });
            return;
          }
        }
        if (!user) {
          setIfLive({ kind: "signed_out", returnTo: currentReturnTo() });
          return;
        }
        setIfLive(evaluate(user));
      } catch {
        setIfLive({ kind: "signed_out", returnTo: currentReturnTo() });
      }
    })();

    const onLoaded = (u: User) => setState(evaluate(u));
    const onUnloaded = () =>
      setState({ kind: "signed_out", returnTo: currentReturnTo() });
    const onSilentRenewError = () =>
      setState({ kind: "signed_out", returnTo: currentReturnTo() });
    const onAccessTokenExpired = () =>
      setState({ kind: "signed_out", returnTo: currentReturnTo() });

    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onUnloaded);
    userManager.events.addSilentRenewError(onSilentRenewError);
    userManager.events.addAccessTokenExpired(onAccessTokenExpired);

    return () => {
      cancelled = true;
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onUnloaded);
      userManager.events.removeSilentRenewError(onSilentRenewError);
      userManager.events.removeAccessTokenExpired(onAccessTokenExpired);
    };
  }, [userManager]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      userManager,
      requireMfa: () => {
        const s = stateRef.current;
        const email = s.kind === "member" || s.kind === "no_role" || s.kind === "mfa_required" ? s.email : "";
        setState({ kind: "mfa_required", email });
      },
      reset: () => setState({ kind: "loading" }),
    }),
    [state, userManager]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
