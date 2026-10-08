import type { ReactNode } from "react";
import {
  Box,
  DialogTitle,
  dialogContentClasses,
} from "@mui/material";
import HelpButton from "./HelpButton";
import type { HelpKey } from "./helpKeys";

interface Props {
  children: ReactNode;
  help: HelpKey;
  id?: string;
}

// A dialog's title with its help button at the end. The button sits beside
// the DialogTitle rather than in it, so the dialog is named by the title
// text alone; the row keeps the title's right padding and, like a bare
// DialogTitle, takes the top padding off the DialogContent after it.
export default function DialogTitleWithHelp({ children, help, id }: Props) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        pr: 3,
        flex: "0 0 auto",
        [`& + .${dialogContentClasses.root}:not(.${dialogContentClasses.dividers})`]: {
          pt: 0,
        },
      }}
    >
      <DialogTitle id={id} sx={{ pr: 0, minWidth: 0 }}>
        {children}
      </DialogTitle>
      <HelpButton topic={help} />
    </Box>
  );
}
