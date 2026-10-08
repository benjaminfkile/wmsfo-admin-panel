import { useState } from "react";
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
import type { Icon } from "../../api/types";
import ErrorAlert from "../../components/ErrorAlert";
import { PAGE_SETTINGS_LABELS as L } from "../../components/content/labels";
import PageIconField from "./PageIconField";
import { slugify, validatePage, type PageErrors } from "../../validation/page";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";

export interface PageCreateSubmit {
  slug: string;
  title: string;
  navLabel: string | null;
  icon: Icon | null;
}

interface Props {
  open: boolean;
  onCancel: () => void;
  onCreate: (body: PageCreateSubmit) => void;
  pending?: boolean;
  error?: unknown;
}

// New-page dialog (admin.md 6.13). Slug auto-derives from the title but
// stays editable; navLabel is optional and separately toggled by "in
// navigation"; the Menu icon is optional and clearable.
export default function PageCreateDialog({
  open,
  onCancel,
  onCreate,
  pending = false,
  error,
}: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [inNav, setInNav] = useState(true);
  const [navLabel, setNavLabel] = useState("");
  const [icon, setIcon] = useState<Icon | null>(null);
  const [errors, setErrors] = useState<PageErrors>({});

  const reset = () => {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setInNav(true);
    setNavLabel("");
    setIcon(null);
    setErrors({});
  };

  const handleTitle = (next: string) => {
    setTitle(next);
    if (!slugTouched) setSlug(slugify(next));
  };

  const submit = () => {
    const effectiveNav = inNav ? (navLabel.trim() === "" ? title.trim() : navLabel.trim()) : "";
    const errs = validatePage({
      slug: slug.trim(),
      title: title.trim(),
      navLabel: effectiveNav,
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onCreate({
      slug: slug.trim(),
      title: title.trim(),
      navLabel: inNav ? effectiveNav : null,
      icon,
    });
  };

  return (
    <AppDialog
      open={open}
      onClose={() => {
        onCancel();
        reset();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitleWithHelp help="pages.create">New page</DialogTitleWithHelp>
      <DialogContent>
        {error ? <ErrorAlert error={error} /> : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={L.title?.label}
            value={title}
            onChange={(e) => handleTitle(e.target.value)}
            error={Boolean(errors.title)}
            helperText={errors.title ?? " "}
            required
            fullWidth
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            error={Boolean(errors.slug)}
            helperText={errors.slug ?? L.slug?.help}
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
              placeholder={title}
              error={Boolean(errors.navLabel)}
              helperText={errors.navLabel ?? L.navLabel?.help}
              fullWidth
            />
          ) : null}
          <PageIconField value={icon} onChange={setIcon} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onCancel();
            reset();
          }}
        >
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={pending}>
          Create
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
