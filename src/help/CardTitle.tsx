import type { ReactNode } from "react";
import { Stack, Typography, type SxProps, type Theme } from "@mui/material";
import HelpButton from "./HelpButton";
import type { HelpKey } from "./helpKeys";

interface Props {
  children: ReactNode;
  help: HelpKey;
  variant?: "h6" | "subtitle1";
  gutterBottom?: boolean;
  sx?: SxProps<Theme>;
}

// A card's title with its help button at the end. `gutterBottom` and
// `sx` carry the spacing the plain title had; `sx` lands on the row.
export default function CardTitle({
  children,
  help,
  variant = "h6",
  gutterBottom,
  sx,
}: Props) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      sx={[{ minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <Typography variant={variant} gutterBottom={gutterBottom} sx={{ minWidth: 0 }}>
        {children}
      </Typography>
      <HelpButton topic={help} />
    </Stack>
  );
}
