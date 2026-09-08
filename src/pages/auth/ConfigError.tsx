import { Alert, Container, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";

interface Props {
  missing: string[];
}

export default function ConfigError({ missing }: Props) {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h5" component="h1">
            Configuration error
          </Typography>
          <Alert severity="error">
            The panel cannot start. The following environment variables are
            missing or invalid.
          </Alert>
          <List dense>
            {missing.map((name) => (
              <ListItem key={name} disableGutters>
                <ListItemText
                  primary={<code>{name}</code>}
                />
              </ListItem>
            ))}
          </List>
        </Stack>
      </Paper>
    </Container>
  );
}
