import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { signOut } from "../../auth/signOut";
import { useConfig } from "../../ConfigContext";
import EnvBadge from "../../components/EnvBadge";

interface Props {
  email: string;
}

export default function NoRole({ email }: Props) {
  const { userManager } = useAuth();
  const config = useConfig();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="h5" component="h1">
              This account has no role
            </Typography>
            <EnvBadge />
          </Box>
          <Typography variant="body1">
            Signed in as <strong>{email}</strong>. This account is not a member
            of the admin or editor group and cannot use the panel.
          </Typography>
          <Button variant="outlined" onClick={() => signOut(userManager, config)}>
            Sign out
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
