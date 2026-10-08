import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { formatStamp } from "../../lib/time";
import type { HelpTopic } from "../../api/types";
import { HELP_KEYS, HELP_PAGES, type HelpKey } from "../../help/helpKeys";
import { useHelpTopics } from "../../help/useHelpTopics";
import { useIsHelpAdmin } from "../../help/helpRole";
import HelpEditDialog from "../../help/HelpEditDialog";

type Row = {
  key: HelpKey;
  page: string;
  label: string;
  topic: HelpTopic | undefined;
};

const PREVIEW_CHARS = 80;

// The pages of the registry in their first-seen order.
const PAGE_ORDER: string[] = Array.from(
  new Set(HELP_KEYS.map((k) => HELP_PAGES[k].page))
);

function isUnwritten(t: HelpTopic | undefined): boolean {
  return (t?.body ?? "").trim().length === 0;
}

function preview(body: string | undefined): string {
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}...` : text;
}

// Every help topic of the panel, grouped by page in registry order, with
// a search over key, title, and body and two filters. Admins edit a
// topic from its pencil.
export default function HelpPage() {
  const isAdmin = useIsHelpAdmin();
  const { query, topicFor } = useHelpTopics();
  const [search, setSearch] = useState("");
  const [unwrittenOnly, setUnwrittenOnly] = useState(false);
  const [changedOnly, setChangedOnly] = useState(false);
  const [editing, setEditing] = useState<HelpKey | null>(null);

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows: Row[] = HELP_KEYS.map((key) => ({
      key,
      page: HELP_PAGES[key].page,
      label: HELP_PAGES[key].label,
      topic: topicFor(key),
    })).filter((r) => {
      if (unwrittenOnly && !isUnwritten(r.topic)) return false;
      if (changedOnly && !r.topic?.defaultChanged) return false;
      if (needle.length === 0) return true;
      return [r.key, r.topic?.title ?? "", r.topic?.body ?? ""].some((s) =>
        s.toLowerCase().includes(needle)
      );
    });
    return PAGE_ORDER.map((page) => ({
      page,
      rows: rows.filter((r) => r.page === page),
    })).filter((g) => g.rows.length > 0);
  }, [search, unwrittenOnly, changedOnly, topicFor]);

  const columns: Column<Row>[] = [
    {
      key: "label",
      header: "Topic",
      role: "title",
      render: (r) => r.label,
    },
    {
      key: "title",
      header: "Title",
      role: "subtitle",
      render: (r) => r.topic?.title ?? "",
    },
    {
      key: "body",
      header: "Text",
      role: "line",
      label: "Text",
      render: (r) =>
        isUnwritten(r.topic) ? (
          <Typography variant="body2" color="text.secondary" component="span">
            Not written
          </Typography>
        ) : (
          preview(r.topic?.body)
        ),
    },
    {
      key: "links",
      header: "Links",
      role: "line",
      label: "Links",
      align: "right",
      render: (r) => String(r.topic?.links?.length ?? 0),
    },
    {
      key: "edited",
      header: "Edited",
      role: "chip",
      render: (r) =>
        r.topic?.edited ? (
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Chip size="small" label="Edited" color="info" variant="outlined" />
            <Typography variant="caption" color="text.secondary">
              {[r.topic.editedBy, formatStamp(r.topic.editedAt)]
                .filter((s) => s)
                .join(" ")}
            </Typography>
            {r.topic.defaultChanged && (
              <Chip size="small" label="Default changed" color="warning" variant="outlined" />
            )}
          </Stack>
        ) : null,
    },
  ];

  return (
    <Box>
      <PageHeader title="Help" />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The text behind every help button in the panel.
        {isAdmin ? " Edit a topic to change what everyone sees." : ""}
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap" alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 280 } }}
          />
          <Chip
            label="Unwritten"
            color={unwrittenOnly ? "primary" : "default"}
            variant={unwrittenOnly ? "filled" : "outlined"}
            aria-pressed={unwrittenOnly}
            onClick={() => setUnwrittenOnly((v) => !v)}
          />
          <Chip
            label="Default changed"
            color={changedOnly ? "primary" : "default"}
            variant={changedOnly ? "filled" : "outlined"}
            aria-pressed={changedOnly}
            onClick={() => setChangedOnly((v) => !v)}
          />
        </Stack>
      </Paper>

      {query.error ? <ErrorAlert error={query.error} /> : null}
      {query.isLoading ? (
        <CircularProgress />
      ) : groups.length === 0 ? (
        <Alert severity="info">No help topics match.</Alert>
      ) : (
        <Stack spacing={3}>
          {groups.map((g) => (
            <Box key={g.page} data-testid={`help-group-${g.page}`}>
              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                {g.page}
              </Typography>
              <ResponsiveTable<Row>
                rows={g.rows}
                columns={columns}
                rowKey={(r) => r.key}
                rowTestId={(r) => `help-row-${r.key}`}
                emptyText="No help topics match."
                actions={
                  isAdmin
                    ? (r) => (
                        <IconButton
                          size="small"
                          aria-label={`Edit ${r.label}`}
                          onClick={() => setEditing(r.key)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )
                    : undefined
                }
              />
            </Box>
          ))}
        </Stack>
      )}
      {editing !== null && (
        <HelpEditDialog
          open
          helpKey={editing}
          topic={topicFor(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </Box>
  );
}
