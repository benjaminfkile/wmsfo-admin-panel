import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Stack,
  TextField,
} from "@mui/material";
import AppDialog from "../../components/AppDialog";
import type { Icon, PageAdmin, PageDetail } from "../../api/types";
import ErrorAlert from "../../components/ErrorAlert";
import { PAGE_SETTINGS_LABELS as L } from "../../components/content/labels";
import PageIconField from "./PageIconField";
import { validatePage, type PageErrors } from "../../validation/page";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";

export interface PageSettingsSubmit {
  slug: string;
  title: string;
  navLabel: string | null;
  icon: Icon | null;
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
// the "in navigation" toggle, the Menu icon, and `isHidden`. Save sends
// `icon` every time, null when cleared.
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
  const [icon, setIcon] = useState<Icon | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const [errors, setErrors] = useState<PageErrors>({});

  useEffect(() => {
    if (!open) return;
    setSlug(page.slug ?? "");
    setTitle(page.title ?? "");
    setInNav(page.navLabel !== null && page.navLabel !== undefined);
    setNavLabel(page.navLabel ?? "");
    setIcon((page.icon as Icon | null | undefined) ?? null);
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
      icon,
      isHidden,
    });
  };

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitleWithHelp help="pages.settings">
        Page settings
      </DialogTitleWithHelp>
      <DialogContent>
        {error ? <ErrorAlert error={error} /> : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={L.slug?.label}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            error={Boolean(errors.slug)}
            helperText={errors.slug ?? " "}
            required
            fullWidth
          />
          <TextField
            label={L.title?.label}
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
              label={L.navLabel?.label}
              value={navLabel}
              onChange={(e) => setNavLabel(e.target.value)}
              error={Boolean(errors.navLabel)}
              helperText={errors.navLabel ?? L.navLabel?.help}
              fullWidth
            />
          ) : null}
          <PageIconField value={icon} onChange={setIcon} />
          <FormControlLabel
            control={
              <Checkbox
                checked={isHidden}
                onChange={(e) => setIsHidden(e.target.checked)}
              />
            }
            label={L.isHidden?.label}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={pending}>
          Save
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
