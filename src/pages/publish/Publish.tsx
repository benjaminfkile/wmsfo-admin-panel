import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { content as contentApi } from "../../api/resources/content";
import { keys } from "../../queries/keys";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import { ApiError } from "../../api/errors";
import { formatStamp, formatAgeS, ageS } from "../../lib/time";
import { useNow } from "../../hooks/useNow";
import VersionsList from "./VersionsList";
import PublishLabelDialog from "./PublishLabelDialog";
import { usePublishMutation } from "./usePublish";
import type { ProblemRef } from "../../api/types";

function problemLink(p: ProblemRef): string {
  const pageId = p.pageId;
  const sectionId = p.sectionId;
  if (pageId !== null && pageId !== undefined) {
    const url = `/pages/${String(pageId)}`;
    if (sectionId !== null && sectionId !== undefined) {
      return `${url}#section-${String(sectionId)}`;
    }
    return url;
  }
  // No page id means the problem lives on site settings.
  return "/site-settings";
}

function problemLinkLabel(p: ProblemRef): string {
  if (p.pageId !== null && p.pageId !== undefined) {
    return p.sectionId !== null && p.sectionId !== undefined
      ? `Open section ${String(p.sectionId)}`
      : `Open page ${String(p.pageId)}`;
  }
  return "Open site settings";
}

// Publish page (admin.md 6.18). Status card, problem list with links,
// a Publish button that opens the label dialog, and the versions list.
export default function Publish() {
  const nowMs = useNow(1000);
  const [publishOpen, setPublishOpen] = useState(false);

  const statusQ = useQuery({
    queryKey: keys.contentStatus,
    queryFn: () => contentApi.status(),
  });

  const publishMut = usePublishMutation();

  const status = statusQ.data;
  const published = status?.published ?? null;
  const problems: ProblemRef[] = useMemo(
    () => status?.problems ?? [],
    [status]
  );
  const hasUnpublished = Boolean(status?.hasUnpublishedChanges);
  const problemCount = problems.length;
  const readyToPublish = hasUnpublished && problemCount === 0;
  const draftAge =
    status?.draftUpdatedAt !== undefined && status?.draftUpdatedAt !== null
      ? formatAgeS(ageS(status.draftUpdatedAt, nowMs))
      : null;
  const publishedAge =
    published?.publishedAt !== undefined && published?.publishedAt !== null
      ? formatAgeS(ageS(published.publishedAt, nowMs))
      : null;

  const contentUnchanged =
    publishMut.error instanceof ApiError &&
    publishMut.error.code === "content_unchanged";
  const contentInvalid =
    publishMut.error instanceof ApiError &&
    publishMut.error.code === "content_invalid";

  return (
    <Stack spacing={3}>
      <PageHeader title="Publish" />

      {statusQ.error ? (
        <ErrorAlert error={statusQ.error} />
      ) : (
        <Paper sx={{ p: 2 }} variant="outlined" data-testid="content-status">
          <Stack spacing={1}>
            {published ? (
              <Typography variant="body1">
                Published version <strong>{String(published.id ?? "")}</strong>{" "}
                {published.label ? `(${published.label})` : "(no label)"} by{" "}
                {published.publishedBy ?? "none"}{" "}
                <Typography
                  component="span"
                  color="text.secondary"
                  variant="body2"
                  title={formatStamp(published.publishedAt ?? null)}
                >
                  {publishedAge ?? "none"}
                </Typography>
              </Typography>
            ) : (
              <Typography variant="body1">Nothing published yet.</Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Draft changed{" "}
              <span title={formatStamp(status?.draftUpdatedAt ?? null)}>
                {draftAge ?? "never"}
              </span>
            </Typography>
            {!hasUnpublished ? (
              <Alert severity="info" data-testid="status-no-changes">
                No unpublished changes
              </Alert>
            ) : problemCount === 0 ? (
              <Alert severity="success" data-testid="status-ready">
                Ready to publish
              </Alert>
            ) : (
              <Alert severity="error" data-testid="status-blocked">
                {problemCount} problem{problemCount === 1 ? "" : "s"} block
                {problemCount === 1 ? "s" : ""} publishing
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                variant="contained"
                onClick={() => setPublishOpen(true)}
                disabled={!readyToPublish || publishMut.isPending}
                data-testid="publish-button"
              >
                Publish
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {problems.length > 0 ? (
        <Paper sx={{ p: 2 }} variant="outlined">
          <Typography variant="h6" gutterBottom>
            Problems
          </Typography>
          <List dense data-testid="problem-ref-list">
            {problems.map((p, i) => (
              <ListItem
                key={`${p.path ?? ""}-${i}`}
                secondaryAction={
                  <Chip
                    label={problemLinkLabel(p)}
                    component={RouterLink}
                    to={problemLink(p)}
                    clickable
                    variant="outlined"
                    size="small"
                    data-testid={`problem-link-${i}`}
                  />
                }
                disablePadding
              >
                <ListItemButton
                  component={RouterLink}
                  to={problemLink(p)}
                  data-testid={`problem-row-${i}`}
                >
                  <ListItemText primary={p.message} secondary={p.path} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      ) : null}

      {contentUnchanged ? (
        <Alert severity="info" data-testid="publish-nothing">
          Nothing to publish
        </Alert>
      ) : contentInvalid ? (
        <Alert severity="error" data-testid="publish-invalid">
          The draft has publish problems; the list above was refreshed.
        </Alert>
      ) : publishMut.error ? (
        <ErrorAlert error={publishMut.error} />
      ) : null}

      <Divider />

      <VersionsList
        currentPublishedId={
          published?.id !== undefined && published?.id !== null
            ? Number(published.id)
            : null
        }
      />

      <PublishLabelDialog
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onConfirm={(label) =>
          publishMut.mutate(label, { onSuccess: () => setPublishOpen(false) })
        }
        disabled={publishMut.isPending}
      />
    </Stack>
  );
}
