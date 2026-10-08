import type { ReactNode } from "react";
import { Stack, Typography } from "@mui/material";
import HelpButton from "./HelpButton";
import type { HelpKey } from "./helpKeys";

interface Props {
  children: ReactNode;
  help: HelpKey;
  variant?: "h6" | "subtitle1";
}

// A card's title with its help button at the end.
export default function CardTitle({ children, help, variant = "h6" }: Props) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
      <Typography variant={variant} sx={{ minWidth: 0 }}>
        {children}
      </Typography>
      <HelpButton topic={help} />
    </Stack>
  );
}
