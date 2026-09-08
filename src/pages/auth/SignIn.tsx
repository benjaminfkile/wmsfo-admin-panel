import { Alert, Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import EnvBadge from "../../components/EnvBadge";

interface Props {
  returnTo?: string;
}

export default function SignIn({ returnTo }: Props) {
  const { userManager } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    try {
      await userManager.signinRedirect({ state: { returnTo: returnTo ?? "/" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h4" component="h1">
              WMSFO Admin
            </Typography>
            <EnvBadge />
          </Box>
          <Typography variant="body1">
            Sign in with your WMSFO admin account to continue.
          </Typography>
          {error !== null && <Alert severity="error">{error}</Alert>}
          <Button variant="contained" size="large" onClick={handleSignIn}>
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
