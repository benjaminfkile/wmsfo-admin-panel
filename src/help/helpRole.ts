import { useAuth } from "../auth/AuthProvider";

// Admins write help texts; every other role only reads them.
export function useIsHelpAdmin(): boolean {
  const { state } = useAuth();
  return state.kind === "member" && state.role === "admin";
}
