import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";

export default function Callback() {
  const { userManager } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await userManager.signinCallback();
        if (cancelled) return;
        const returnTo =
          (user?.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
        navigate(returnTo, { replace: true });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userManager, navigate]);

  const retry = async () => {
    setError(null);
    try {
      await userManager.signinRedirect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error === null) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h5" component="h1">
            Sign-in failed
          </Typography>
          <Alert severity="error">{error}</Alert>
          <Button variant="contained" onClick={retry}>
            Try again
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
