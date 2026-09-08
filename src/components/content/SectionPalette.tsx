import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { KindInfo } from "../../api/types";

interface Props {
  open: boolean;
  onCancel: () => void;
  onChoose: (kind: KindInfo) => void;
  kinds: KindInfo[];
  pageRole: string;
}

// Section palette (admin.md 6.14). Every kind is a button; kinds whose
// `allowedRoles` exclude this page's role are disabled with a tooltip.
export default function SectionPalette({
  open,
  onCancel,
  onChoose,
  kinds,
  pageRole,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Add a section</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1}>
          {kinds.map((k) => {
            const allowed =
              !Array.isArray(k.allowedRoles) ||
              k.allowedRoles.includes(pageRole);
            const reason = allowed
              ? undefined
              : `Not allowed on the "${pageRole}" page`;
            return (
              <Tooltip key={k.kind} title={reason ?? ""} disableHoverListener={allowed}>
                <span>
                  <Button
                    variant="outlined"
                    fullWidth
                    disabled={!allowed}
                    onClick={() => onChoose(k)}
                    data-testid={`palette-kind-${k.kind}`}
                  >
                    <Box sx={{ textAlign: "left", width: "100%" }}>
                      <Typography variant="subtitle2">{k.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {k.description}
                      </Typography>
                    </Box>
                  </Button>
                </span>
              </Tooltip>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
