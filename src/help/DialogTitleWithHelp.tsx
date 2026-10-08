import type { ReactNode } from "react";
import { Box, DialogTitle } from "@mui/material";
import HelpButton from "./HelpButton";
import type { HelpKey } from "./helpKeys";

interface Props {
  children: ReactNode;
  help: HelpKey;
}

// A dialog's title with its help button at the end.
export default function DialogTitleWithHelp({ children, help }: Props) {
  return (
    <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Box component="span" sx={{ minWidth: 0 }}>
        {children}
      </Box>
      <HelpButton topic={help} />
    </DialogTitle>
  );
}
