import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Autocomplete,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AppDialog from "../components/AppDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorAlert from "../components/ErrorAlert";
import { help, type HelpTopicBody } from "../api/resources/help";
import type { HelpTopic } from "../api/types";
import { useNotify } from "../hooks/useNotify";
import { fieldErrorFor } from "../lib/fieldErrors";
import { keys } from "../queries/keys";
import { ALL_ROUTES } from "../routesConfig";
import { HELP_PAGES } from "./helpKeys";
import {
  BODY_MAX,
  BODY_SOFT_MAX,
  DASHES,
  LINKS_MAX,
  LINK_LABEL_MAX,
  TITLE_MAX,
  isValidDestination,
} from "./helpRules";

// Every path the drawer reaches, offered by the link destination picker.
const ROUTE_OPTIONS = ALL_ROUTES.map((r) => r.path);
const ROUTE_LABELS = new Map(ALL_ROUTES.map((r) => [r.path, r.label]));

type LinkRow = { label: string; to: string };

type Errors = {
  title?: string;
  body?: string;
  links: Array<{ label?: string; to?: string }>;
};

function validate(title: string, body: string, links: LinkRow[]): Errors {
  const errors: Errors = { links: [] };
  const t = title.trim();
  if (t.length === 0) errors.title = "Title is required";
  else if (t.length > TITLE_MAX) errors.title = `Title is at most ${TITLE_MAX} characters`;
  else if (DASHES.test(t)) errors.title = "Use a hyphen or a comma instead of a long dash";
  const b = body.trim();
  if (b.length === 0) errors.body = "Body is required";
  else if (b.length > BODY_MAX) errors.body = `Body is at most ${BODY_MAX} characters`;
  else if (DASHES.test(b)) errors.body = "Use a hyphen or a comma instead of a long dash";
  errors.links = links.map((l) => {
    const e: { label?: string; to?: string } = {};
    const label = l.label.trim();
    const to = l.to.trim();
    if (label.length === 0) e.label = "Label is required";
    else if (label.length > LINK_LABEL_MAX)
      e.label = `Label is at most ${LINK_LABEL_MAX} characters`;
    else if (DASHES.test(label))
      e.label = "Use a hyphen or a comma instead of a long dash";
    if (to.length === 0) e.to = "Destination is required";
    else if (!isValidDestination(to)) e.to = "Starts with / or https://";
    return e;
  });
  return errors;
}

function hasErrors(e: Errors): boolean {
  return (
    e.title !== undefined ||
    e.body !== undefined ||
    e.links.some((l) => l.label !== undefined || l.to !== undefined)
  );
}

interface Props {
  open: boolean;
  helpKey: string;
  topic: HelpTopic | undefined;
  onClose: () => void;
}

// The admin editor for one help topic: title, plain-text body, and up to
// six links. Save PUTs the topic; an edited topic can be reset to the
// shipped default after a confirmation.
export default function HelpEditDialog({ open, helpKey, topic, onClose }: Props) {
  const qc = useQueryClient();
  const notify = useNotify();
  const label =
    topic?.label || HELP_PAGES[helpKey as keyof typeof HELP_PAGES]?.label || helpKey;
  const [title, setTitle] = useState(topic?.title ?? label);
  const [body, setBody] = useState(topic?.body ?? "");
  const [links, setLinks] = useState<LinkRow[]>(
    (topic?.links ?? []).map((l) => ({ label: l.label ?? "", to: l.to ?? "" }))
  );
  // Validation shows after the first Save and then follows every edit.
  const [checked, setChecked] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const save = useMutation({
    mutationFn: (b: HelpTopicBody) => help.put(helpKey, b),
    onSuccess: () => {
      notify("Help saved");
      void qc.invalidateQueries({ queryKey: keys.help });
      onClose();
    },
  });

  const reset = useMutation({
    mutationFn: () => help.reset(helpKey),
    onSuccess: () => {
      setConfirmReset(false);
      notify("Help reset");
      void qc.invalidateQueries({ queryKey: keys.help });
      onClose();
    },
    onError: () => setConfirmReset(false),
  });

  const shown: Errors = checked ? validate(title, body, links) : { links: [] };
  const titleError = shown.title ?? fieldErrorFor(save.error, "title");
  const bodyLength = body.trim().length;
  const bodyError =
    shown.body ??
    (bodyLength > BODY_MAX ? `Body is at most ${BODY_MAX} characters` : null) ??
    fieldErrorFor(save.error, "body");
  const bodyHelper =
    bodyError ??
    (bodyLength > BODY_SOFT_MAX
      ? `Keep it short: a popover. ${bodyLength} / ${BODY_MAX}`
      : `${bodyLength} / ${BODY_MAX}`);

  const setLink = (i: number, patch: Partial<LinkRow>) =>
    setLinks((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const handleSave = () => {
    setChecked(true);
    if (hasErrors(validate(title, body, links))) return;
    save.mutate({
      title: title.trim(),
      body: body.trim(),
      links: links.map((l) => ({ label: l.label.trim(), to: l.to.trim() })),
    });
  };

  return (
    <>
      <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit help: {label}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {save.error !== null && (
              <ErrorAlert
                error={save.error}
                handledFields={["title", "body"]}
              />
            )}
            {reset.error !== null && <ErrorAlert error={reset.error} />}
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={titleError !== null && titleError !== undefined}
              helperText={titleError ?? undefined}
              slotProps={{ htmlInput: { maxLength: TITLE_MAX + 20 } }}
              fullWidth
            />
            <TextField
              label="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline
              minRows={5}
              error={bodyError !== null && bodyError !== undefined}
              helperText={bodyHelper}
              fullWidth
            />
            <Typography variant="caption" color="text.secondary">
              Plain text. A blank line starts a new paragraph; lines that
              start with &quot;- &quot; become a bullet list.
            </Typography>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                See also
              </Typography>
              <Stack spacing={1.5}>
                {links.map((l, i) => (
                  <Stack
                    key={i}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", sm: "flex-start" }}
                    data-testid={`help-link-${i}`}
                  >
                    <TextField
                      label="Label"
                      size="small"
                      value={l.label}
                      onChange={(e) => setLink(i, { label: e.target.value })}
                      error={shown.links[i]?.label !== undefined}
                      helperText={shown.links[i]?.label}
                      sx={{ flex: 1 }}
                    />
                    <Autocomplete
                      freeSolo
                      options={ROUTE_OPTIONS}
                      inputValue={l.to}
                      onInputChange={(_e, v) => setLink(i, { to: v })}
                      onChange={(_e, v) => setLink(i, { to: v ?? "" })}
                      renderOption={(props, option) => {
                        const { key, ...rest } = props;
                        return (
                          <li key={key} {...rest}>
                            {`${option} (${ROUTE_LABELS.get(option) ?? option})`}
                          </li>
                        );
                      }}
                      sx={{ flex: 1.4 }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Destination"
                          size="small"
                          error={shown.links[i]?.to !== undefined}
                          helperText={shown.links[i]?.to ?? "A panel path or an https:// address"}
                        />
                      )}
                    />
                    <IconButton
                      aria-label={`Remove link ${i + 1}`}
                      onClick={() => {
                        setLinks((rows) => rows.filter((_r, j) => j !== i));
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                ))}
                <Box>
                  <Button
                    startIcon={<AddIcon />}
                    disabled={links.length >= LINKS_MAX}
                    onClick={() => {
                      setLinks((rows) => [...rows, { label: "", to: "" }]);
                    }}
                  >
                    Add link
                  </Button>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          {topic?.edited && (
            <Button
              color="warning"
              onClick={() => setConfirmReset(true)}
              disabled={reset.isPending}
              sx={{ mr: "auto" }}
            >
              Reset to default
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={save.isPending || bodyLength > BODY_MAX}
          >
            Save
          </Button>
        </DialogActions>
      </AppDialog>
      <ConfirmDialog
        open={confirmReset}
        title="Reset to default"
        body="Replace your text with the shipped default?"
        confirmLabel="Reset"
        disabled={reset.isPending}
        onConfirm={() => reset.mutate()}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
