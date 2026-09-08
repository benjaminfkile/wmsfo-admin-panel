import { Alert } from "@mui/material";

interface Props {
  visible: boolean;
}

export default function NetworkBanner({ visible }: Props) {
  if (!visible) return null;
  return (
    <Alert severity="warning" sx={{ borderRadius: 0 }}>
      API unreachable
    </Alert>
  );
}
