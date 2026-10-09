import { Button, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import AppDialog from "../../components/AppDialog";
import type { TrackerTheme } from "../../api/types";

interface Props {
  // The theme being edited, or null for a new theme.
  theme: TrackerTheme | null;
  onClose: () => void;
}

// The theme editor's dialog shell (admin.md 6.28): the title and a
// Close button. It mounts only while open.
export default function ThemeEditorDialog({ theme, onClose }: Props) {
  return (
    <AppDialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {theme ? `Edit ${theme.name ?? "theme"}` : "New theme"}
      </DialogTitle>
      <DialogContent />
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </AppDialog>
  );
}
