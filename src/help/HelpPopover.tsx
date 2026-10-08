import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  List,
  ListItem,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import AppDialog from "../components/AppDialog";
import { useCompact } from "../hooks/useCompact";
import type { HelpTopic } from "../api/types";
import { HELP_PAGES, type HelpKey } from "./helpKeys";
import { renderBody } from "./helpText";
import { useHelpTopics } from "./useHelpTopics";
import { useIsHelpAdmin } from "./helpRole";
import { UNWRITTEN_TEXT } from "./helpRules";

interface Props {
  topic: HelpKey;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onEdit: () => void;
}

// The topic's text: a popover anchored to the button on desktop, an
// `AppDialog` (full screen below sm) on compact. A topic the API did not
// return shows the registry label and the unwritten sentence.
export default function HelpPopover({ topic, anchorEl, onClose, onEdit }: Props) {
  const compact = useCompact();
  const isAdmin = useIsHelpAdmin();
  const { topicFor } = useHelpTopics();
  const data = topicFor(topic);
  const title = data?.title || HELP_PAGES[topic]?.label || topic;
  const open = anchorEl !== null;
  const editButton = isAdmin ? (
    <IconButton aria-label="Edit this help" size="small" onClick={onEdit}>
      <EditIcon fontSize="small" />
    </IconButton>
  ) : null;

  if (compact) {
    return (
      <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
            {title}
          </Box>
          {editButton}
          <IconButton aria-label="Close" edge="end" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <HelpContent data={data} onNavigate={onClose} />
        </DialogContent>
      </AppDialog>
    );
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { maxWidth: 360, p: 2 } } }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="subtitle1" sx={{ flex: 1, minWidth: 0 }}>
          {title}
        </Typography>
        {editButton}
      </Stack>
      <HelpContent data={data} onNavigate={onClose} />
    </Popover>
  );
}

function HelpContent({
  data,
  onNavigate,
}: {
  data: HelpTopic | undefined;
  onNavigate: () => void;
}) {
  const body = data?.body ?? "";
  const links = data?.links ?? [];
  return (
    <>
      {body.trim().length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {UNWRITTEN_TEXT}
        </Typography>
      ) : (
        renderBody(body)
      )}
      {links.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            See also
          </Typography>
          <List dense disablePadding>
            {links.map((l, i) => (
              <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
                {(l.to ?? "").startsWith("/") ? (
                  <Link component={RouterLink} to={l.to ?? "/"} onClick={onNavigate} variant="body2">
                    {l.label}
                  </Link>
                ) : (
                  <Link href={l.to} target="_blank" rel="noopener" variant="body2">
                    {l.label}
                  </Link>
                )}
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </>
  );
}
