import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
} from "@mui/material";
import type { PageAdmin, PageDetail } from "../../api/types";
import ErrorAlert from "../../components/ErrorAlert";
import { validatePage, type PageErrors } from "../../validation/page";

export interface PageSettingsSubmit {
  slug: string;
  title: string;
  navLabel: string | null;
  isHidden: boolean;
}

interface Props {
  open: boolean;
  page: PageAdmin | PageDetail;
  onCancel: () => void;
  onSave: (body: PageSettingsSubmit) => void;
  pending?: boolean;
  error?: unknown;
}

// Page settings dialog (admin.md 6.13). Edits slug, title, navLabel with
// the "in navigation" toggle, and `isHidden`.
export default function PageSettingsDialog({
  open,
  page,
  onCancel,
  onSave,
  pending = false,
  error,
}: Props) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [inNav, setInNav] = useState(true);
  const [navLabel, setNavLabel] = useState("");
  const [isHidden, setIsHidden] = useState(false);
  const [errors, setErrors] = useState<PageErrors>({});

  useEffect(() => {
    if (!open) return;
    setSlug(page.slug ?? "");
    setTitle(page.title ?? "");
    setInNav(page.navLabel !== null && page.navLabel !== undefined);
    setNavLabel(page.navLabel ?? "");
    setIsHidden(Boolean(page.isHidden));
    setErrors({});
  }, [open, page]);

  const submit = () => {
    const effectiveNav = inNav ? (navLabel.trim() === "" ? title.trim() : navLabel.trim()) : "";
    const errs = validatePage({
      slug: slug.trim(),
      title: title.trim(),
      navLabel: effectiveNav,
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSave({
      slug: slug.trim(),
      title: title.trim(),
      navLabel: inNav ? effectiveNav : null,
      isHidden,
    });
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Page settings</DialogTitle>
      <DialogContent>
        {error ? <ErrorAlert error={error} /> : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            error={Boolean(errors.slug)}
            helperText={errors.slug ?? " "}
            required
            fullWidth
          />
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={Boolean(errors.title)}
            helperText={errors.title ?? " "}
            required
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={inNav}
                onChange={(e) => setInNav(e.target.checked)}
              />
            }
            label="Show in navigation"
          />
          {inNav ? (
            <TextField
              label="Nav label"
              value={navLabel}
              onChange={(e) => setNavLabel(e.target.value)}
              error={Boolean(errors.navLabel)}
              helperText={errors.navLabel ?? "Defaults to the page title"}
              fullWidth
            />
          ) : null}
          <FormControlLabel
            control={
              <Checkbox
                checked={isHidden}
                onChange={(e) => setIsHidden(e.target.checked)}
              />
            }
            label="Hidden"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={pending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
