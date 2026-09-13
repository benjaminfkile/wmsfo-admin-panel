import { Alert, Typography } from "@mui/material";

// Placeholder per admin.md 6.1 and 6.25 until M31 delivers the camera
// view. Kept as its own page so canvasser sign-in lands here.
export default function ScanPlaceholder() {
  return (
    <>
      <Typography variant="h4" gutterBottom>
        Scan
      </Typography>
      <Alert severity="info">
        The camera view lands in M31. For now, open a printed code with a phone
        to open the site.
      </Alert>
    </>
  );
}
