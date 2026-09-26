import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import LinkIcon from "@mui/icons-material/Link";
import ImageIcon from "@mui/icons-material/Image";
import EventNoteIcon from "@mui/icons-material/EventNote";
import IconPicker from "./pickers/IconPicker";
import AppDialog from "../AppDialog";
import {
  renderInlinePreview,
  type InlineEventContext,
} from "./renderInlinePreview";
import { useCurrentEvent } from "./useCurrentEvent";
import type { Icon } from "../../api/types";

interface Props {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  ariaLabel?: string;
  maxLength?: number;
  multiline?: boolean;
  minRows?: number;
  onBlur?: () => void;
  testId?: string;
  eventOverride?: InlineEventContext;
}

const COUNTER_THRESHOLD = 0.9;

// The single inline text editor used by InlineField and by every block
// text field (admin.md 6.14). A text input with a compact toolbar
// (Bold, Italic, Link, Insert icon, Insert event field), a one-line
// preview under it that renders the same constructs the site does, and
// a character counter shown only within the last 10% of `maxLength`.
export default function InlineText({
  value,
  onChange,
  label,
  ariaLabel,
  maxLength = 5000,
  multiline = false,
  minRows,
  onBlur,
  testId,
  eventOverride,
}: Props) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [savedRange, setSavedRange] = useState<[number, number] | null>(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [eventAnchor, setEventAnchor] = useState<HTMLElement | null>(null);

  const currentEvent = useCurrentEvent();
  const effectiveEvent =
    eventOverride === undefined ? currentEvent : eventOverride;

  const getSelection = (): [number, number] => {
    const el = inputRef.current;
    if (!el) return [value.length, value.length];
    const start = typeof el.selectionStart === "number" ? el.selectionStart : value.length;
    const end = typeof el.selectionEnd === "number" ? el.selectionEnd : start;
    return [start, end];
  };

  const applyReplacement = (
    start: number,
    end: number,
    replacement: string,
    caretOffsetFromReplacementStart?: number
  ) => {
    const next = value.slice(0, start) + replacement + value.slice(end);
    const clamped =
      next.length > maxLength ? next.slice(0, maxLength) : next;
    onChange(clamped);
    const el = inputRef.current;
    if (!el) return;
    const caret =
      typeof caretOffsetFromReplacementStart === "number"
        ? start + caretOffsetFromReplacementStart
        : start + replacement.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const wrap = (marker: string) => {
    const [start, end] = getSelection();
    const selected = value.slice(start, end);
    const body = selected.length > 0 ? selected : "text";
    const replacement = `${marker}${body}${marker}`;
    applyReplacement(start, end, replacement);
  };

  const openLinkDialog = () => {
    setSavedRange(getSelection());
    setLinkHref("");
    setLinkOpen(true);
  };

  const insertLink = () => {
    const range = savedRange ?? getSelection();
    const [start, end] = range;
    const selected = value.slice(start, end);
    const label = selected.length > 0 ? selected : "link";
    const href = linkHref.trim() || "/";
    const replacement = `[${label}](${href})`;
    applyReplacement(start, end, replacement);
    setLinkOpen(false);
    setSavedRange(null);
  };

  const openIconPicker = () => {
    setSavedRange(getSelection());
    setIconOpen(true);
  };

  const insertIcon = (icon: Icon) => {
    const range = savedRange ?? getSelection();
    const [start, end] = range;
    const token =
      icon.source === "media"
        ? `{icon:media:${String(icon.id ?? "")}}`
        : `{icon:${String(icon.id ?? "")}}`;
    applyReplacement(start, end, token);
    setIconOpen(false);
    setSavedRange(null);
  };

  const openEventMenu = (e: React.MouseEvent<HTMLElement>) => {
    setSavedRange(getSelection());
    setEventAnchor(e.currentTarget);
  };

  const insertEvent = (field: "name" | "year" | "scheduledAt") => {
    const range = savedRange ?? getSelection();
    const [start, end] = range;
    applyReplacement(start, end, `{event:${field}}`);
    setEventAnchor(null);
    setSavedRange(null);
  };

  const remaining = maxLength - value.length;
  const showCounter = value.length >= Math.floor(maxLength * COUNTER_THRESHOLD);

  const previewNode = useMemo(
    () => renderInlinePreview(value, effectiveEvent),
    [value, effectiveEvent]
  );

  return (
    <Box data-testid={testId ?? "inline-text"}>
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 0.5 }}
        data-testid="inline-text-toolbar"
      >
        <Tooltip title="Bold">
          <IconButton
            size="small"
            aria-label="Bold"
            onClick={() => wrap("**")}
          >
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic">
          <IconButton
            size="small"
            aria-label="Italic"
            onClick={() => wrap("*")}
          >
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Link">
          <IconButton
            size="small"
            aria-label="Link"
            onClick={openLinkDialog}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert icon">
          <IconButton
            size="small"
            aria-label="Insert icon"
            onClick={openIconPicker}
          >
            <ImageIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert event field">
          <IconButton
            size="small"
            aria-label="Insert event field"
            onClick={openEventMenu}
          >
            <EventNoteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <TextField
        size="small"
        label={label}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next.length > maxLength ? next.slice(0, maxLength) : next);
        }}
        onBlur={onBlur}
        fullWidth
        multiline={multiline}
        minRows={minRows}
        inputProps={{
          maxLength,
          "aria-label": ariaLabel,
        }}
        inputRef={(el: HTMLInputElement | HTMLTextAreaElement | null) => {
          inputRef.current = el;
        }}
      />
      <Box
        data-testid="inline-text-preview"
        sx={{
          mt: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: 0.5,
          border: 1,
          borderColor: "divider",
          minHeight: 24,
          color: value.length === 0 && !effectiveEvent ? "text.secondary" : undefined,
          fontSize: "0.875rem",
        }}
      >
        {value.length === 0 && !effectiveEvent ? (
          <Typography
            variant="caption"
            color="text.secondary"
            data-testid="inline-text-preview-empty"
          >
            (no current event)
          </Typography>
        ) : (
          previewNode
        )}
      </Box>
      {showCounter ? (
        <Typography
          variant="caption"
          color={remaining <= 0 ? "error.main" : "text.secondary"}
          data-testid="inline-text-counter"
        >
          {value.length} / {maxLength}
        </Typography>
      ) : null}
      <AppDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Insert link</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Address"
            value={linkHref}
            onChange={(e) => setLinkHref(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ "aria-label": "Link address" }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={insertLink}>
            Insert
          </Button>
        </DialogActions>
      </AppDialog>
      <IconPicker
        open={iconOpen}
        onCancel={() => {
          setIconOpen(false);
          setSavedRange(null);
        }}
        onPick={(icon) => insertIcon(icon)}
      />
      <Menu
        anchorEl={eventAnchor}
        open={Boolean(eventAnchor)}
        onClose={() => setEventAnchor(null)}
      >
        <MenuItem onClick={() => insertEvent("name")}>Event name</MenuItem>
        <MenuItem onClick={() => insertEvent("year")}>Year</MenuItem>
        <MenuItem onClick={() => insertEvent("scheduledAt")}>
          Scheduled time
        </MenuItem>
      </Menu>
    </Box>
  );
}
