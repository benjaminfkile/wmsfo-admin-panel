import { Alert, Typography } from "@mui/material";

export default function NotAvailable() {
  return (
    <>
      <Typography variant="h4" gutterBottom>
        Not available
      </Typography>
      <Alert severity="warning">Not available for your role</Alert>
    </>
  );
}
