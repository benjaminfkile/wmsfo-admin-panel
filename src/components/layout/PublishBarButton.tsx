import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, IconButton } from "@mui/material";
import PublishIcon from "@mui/icons-material/Publish";
import { useQuery } from "@tanstack/react-query";
import { content as contentApi } from "../../api/resources/content";
import { ApiError } from "../../api/errors";
import { keys } from "../../queries/keys";
import { useCompact } from "../../hooks/useCompact";
import { useNotify } from "../../hooks/useNotify";
import PublishLabelDialog from "../../pages/publish/PublishLabelDialog";
import { usePublishMutation } from "../../pages/publish/usePublish";

// The bar's Publish button (admin.md 6.1). It polls the content status
// every 30 s while the tab is visible and shows only while the draft has
// unpublished changes. With no problems it publishes through the label
// dialog; with problems it carries the problem count and opens the
// Publish page instead.
export default function PublishBarButton() {
  const compact = useCompact();
  const navigate = useNavigate();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const publishMut = usePublishMutation();

  const statusQ = useQuery({
    queryKey: keys.contentStatus,
    queryFn: () => contentApi.status(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const status = statusQ.data;
  if (statusQ.isError || !status?.hasUnpublishedChanges) return null;

  const problemCount = status.problems?.length ?? 0;

  const onClick = () => {
    if (problemCount > 0) navigate("/publish");
    else setOpen(true);
  };

  const onConfirm = (label: string | null) => {
    publishMut.mutate(label, {
      onSuccess: () => setOpen(false),
      onError: (err) => {
        if (err instanceof ApiError && err.code === "content_unchanged") {
          setOpen(false);
          notify("Nothing to publish", "info");
        } else if (err instanceof ApiError && err.code === "content_invalid") {
          setOpen(false);
          notify("The draft has publish problems", "warning");
          navigate("/publish");
        } else {
          notify(err instanceof Error ? err.message : "Publish failed", "error");
        }
      },
    });
  };

  const badged = (child: ReactNode) =>
    problemCount > 0 ? (
      <Badge
        badgeContent={problemCount}
        color="warning"
        data-testid="bar-publish-problems"
      >
        {child}
      </Badge>
    ) : (
      child
    );

  return (
    <Box sx={{ mr: 2 }}>
      {compact ? (
        <IconButton
          color="inherit"
          aria-label="Publish"
          onClick={onClick}
          data-testid="bar-publish"
          sx={{ width: 44, height: 44 }}
        >
          {badged(<PublishIcon />)}
        </IconButton>
      ) : (
        badged(
          <Button
            variant="contained"
            color="secondary"
            onClick={onClick}
            data-testid="bar-publish"
          >
            Publish
          </Button>
        )
      )}
      <PublishLabelDialog
        open={open}
        disabled={publishMut.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={onConfirm}
      />
    </Box>
  );
}
