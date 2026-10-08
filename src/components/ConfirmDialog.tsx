import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import type { ReactNode } from "react";
import AppDialog from "./AppDialog";
import DialogTitleWithHelp from "../help/DialogTitleWithHelp";
import type { HelpKey } from "../help/helpKeys";

interface Props {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  help?: HelpKey;
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  disabled,
  onConfirm,
  onCancel,
  help,
}: Props) {
  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      {help === undefined ? (
        <DialogTitle>{title}</DialogTitle>
      ) : (
        <DialogTitleWithHelp help={help}>{title}</DialogTitleWithHelp>
      )}
      <DialogContent>
        {typeof body === "string" ? (
          <DialogContentText>{body}</DialogContentText>
        ) : (
          body
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          onClick={onConfirm}
          disabled={disabled}
          color={danger ? "error" : "primary"}
          variant="contained"
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
