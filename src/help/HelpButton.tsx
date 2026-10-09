import { useState } from "react";
import { Button, IconButton } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useCompact } from "../hooks/useCompact";
import { HELP_PAGES, type HelpKey } from "./helpKeys";
import { useHelpTopics } from "./useHelpTopics";
import HelpPopover from "./HelpPopover";
import HelpEditDialog from "./HelpEditDialog";

interface Props {
  topic: HelpKey;
  size?: "small" | "medium";
  color?: "default" | "inherit";
  // Renders a text button with this label in place of the icon.
  label?: string;
}

// The help button beside a page, card, or dialog title: 24 px on
// desktop, a 44 px hit area on compact. It opens the topic's popover,
// and the popover's Edit button (admins) opens the editor. The popover
// mounts only while open. `color="inherit"` takes the text colour of
// the surface it sits on, as in the app bar. With `label` it is a text
// button that opens the same popover.
export default function HelpButton({
  topic,
  size = "small",
  color = "default",
  label,
}: Props) {
  const compact = useCompact();
  const { topicFor } = useHelpTopics();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const data = topicFor(topic);
  const title = data?.title || HELP_PAGES[topic]?.label || topic;
  const box = compact ? 44 : 24;
  return (
    <>
      {label === undefined ? (
        <IconButton
          aria-label={`Help: ${title}`}
          data-testid={`help-${topic}`}
          color={color}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ width: box, height: box, p: 0, flexShrink: 0 }}
        >
          <HelpOutlineIcon sx={{ fontSize: size === "medium" ? 22 : 18 }} />
        </IconButton>
      ) : (
        <Button
          variant="text"
          data-testid={`help-${topic}`}
          startIcon={<HelpOutlineIcon />}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          {label}
        </Button>
      )}
      {anchor !== null && (
        <HelpPopover
          topic={topic}
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
          onEdit={() => {
            setAnchor(null);
            setEditing(true);
          }}
        />
      )}
      {editing && (
        <HelpEditDialog
          open
          helpKey={topic}
          topic={data}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
