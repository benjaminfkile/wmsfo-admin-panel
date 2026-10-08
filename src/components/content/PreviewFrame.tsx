import {
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AppDialog from "../AppDialog";
import PreviewPane from "./PreviewPane";
import { useCompact } from "../../hooks/useCompact";
import HelpButton from "../../help/HelpButton";
import type { HelpKey } from "../../help/helpKeys";

interface Props {
  open: boolean;
  onClose: () => void;
  // Slug of the page the preview opens at; when null the frame shows "/".
  initialSlug?: string | null;
  // Show the "Start at" page select and the hint? Defaults to true.
  showPageSelector?: boolean;
  title?: string;
  // Passed to PreviewPane: each change schedules one debounced reload.
  reloadSignal?: number;
  // A help key for a button after the title.
  help?: HelpKey;
}

// The preview dialog (admin.md 6.17): a title bar with a Close button over
// a `PreviewPane`, which holds the iframe, the token, and the toolbar. Full
// screen on compact. `help` puts a help button after the title.
export default function PreviewFrame({
  open,
  onClose,
  initialSlug = null,
  showPageSelector = true,
  title = "Preview",
  reloadSignal,
  help,
}: Props) {
  const compact = useCompact();
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={compact}
      PaperProps={{
        sx: compact
          ? { width: "100%", height: "100%" }
          : { width: "min(1400px, 96vw)", height: "min(900px, 90vh)" },
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ flexGrow: 1, minWidth: 0 }}
          >
            <Typography variant="h6" sx={{ minWidth: 0 }}>
              {title}
            </Typography>
            {help !== undefined && <HelpButton topic={help} />}
          </Stack>
          <IconButton
            aria-label="Close preview"
            onClick={onClose}
            data-testid="preview-close"
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          display: "flex",
          flexDirection: "column",
          p: compact ? 1 : undefined,
        }}
      >
        <PreviewPane
          active={open}
          initialSlug={initialSlug}
          showPageSelector={showPageSelector}
          title={title}
          reloadSignal={reloadSignal}
        />
      </DialogContent>
    </AppDialog>
  );
}
