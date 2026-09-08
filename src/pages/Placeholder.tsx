import { Alert, Typography } from "@mui/material";

interface Props {
  title: string;
}

export default function Placeholder({ title }: Props) {
  return (
    <>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Alert severity="info">This page is not yet implemented.</Alert>
    </>
  );
}
