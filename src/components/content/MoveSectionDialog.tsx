import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import type { KindInfo, PageAdmin } from "../../api/types";

interface Props {
  open: boolean;
  pages: PageAdmin[];
  currentPageId: number;
  kind: KindInfo | null;
  onCancel: () => void;
  onMove: (target: PageAdmin) => void;
}

function pageAllowsKind(page: PageAdmin, kind: KindInfo | null): boolean {
  const allowed = kind?.allowedRoles ?? null;
  if (!allowed) return true;
  const role = page.role ?? "none";
  return allowed.includes(role);
}

// The "Move to page" dialog off SectionCard (admin.md 6.14). Lists the
// other pages; targets whose role forbids the kind render disabled with
// "not allowed on this page". A pick calls the parent's onMove with the
// chosen page.
export default function MoveSectionDialog({
  open,
  pages,
  currentPageId,
  kind,
  onCancel,
  onMove,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const options = pages.filter((p) => Number(p.id) !== currentPageId);

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Move to page</DialogTitle>
      <DialogContent dividers>
        {options.length === 0 ? (
          <Typography color="text.secondary">No other pages.</Typography>
        ) : (
          <List disablePadding>
            {options.map((p) => {
              const id = Number(p.id ?? 0);
              const allowed = pageAllowsKind(p, kind);
              return (
                <ListItemButton
                  key={id}
                  disabled={!allowed}
                  selected={selected === id}
                  onClick={() => setSelected(id)}
                  data-testid={`move-target-${id}`}
                >
                  <ListItemText
                    primary={p.title}
                    secondary={
                      allowed
                        ? `/${p.slug}`
                        : "not allowed on this page"
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={selected === null}
          onClick={() => {
            const target = options.find((p) => Number(p.id) === selected);
            if (target) onMove(target);
          }}
        >
          Move
        </Button>
      </DialogActions>
    </Dialog>
  );
}
