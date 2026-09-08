import type { ReactNode } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./AuthProvider";
import SignIn from "../pages/auth/SignIn";
import NoRole from "../pages/auth/NoRole";
import MfaSetup from "../pages/auth/MfaSetup";

interface Props {
  children: ReactNode;
}

export default function RequireAdmin({ children }: Props) {
  const { state } = useAuth();

  switch (state.kind) {
    case "loading":
      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress role="progressbar" />
        </Box>
      );
    case "signed_out":
      return <SignIn returnTo={state.returnTo} />;
    case "no_role":
      return <NoRole email={state.email} />;
    case "mfa_required":
      return <MfaSetup email={state.email} />;
    case "member":
      return <>{children}</>;
  }
}
