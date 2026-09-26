import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import LinkControl from "./LinkControl";
import type { LinkValue } from "./LinkControl";
import type { Icon } from "../../../api/types";

type BlockLike = { kind: string; [k: string]: unknown };

interface Props {
  value: BlockLike;
  onChange: (next: BlockLike) => void;
}

const STYLES: { value: string; label: string }[] = [
  { value: "buttons", label: "Buttons" },
  { value: "list", label: "List" },
];

const MIN_LINKS = 1;
const MAX_LINKS = 20;

const EMPTY_LINK: LinkValue = {
  label: "",
  href: "",
  icon: null,
  newTab: false,
};

function toLinks(items: unknown): LinkValue[] {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    if (it && typeof it === "object") {
      const o = it as Record<string, unknown>;
      return {
        label: typeof o.label === "string" ? o.label : "",
        href: typeof o.href === "string" ? o.href : "",
        icon:
          o.icon && typeof o.icon === "object" ? (o.icon as Icon) : null,
        newTab: Boolean(o.newTab),
      };
    }
    return { ...EMPTY_LINK };
  });
}

// The links block editor. Style select (Buttons, List) and a sortable
// list of LinkControl rows with remove, up, and down; "Add link"
// appends a fresh link. 1 to 20 links.
export default function LinksBlockEditor({ value, onChange }: Props) {
  const style =
    typeof value.style === "string" &&
    STYLES.some((s) => s.value === value.style)
      ? (value.style as string)
      : "buttons";
  const links = toLinks(value.links);

  const setLinks = (next: LinkValue[]) => onChange({ ...value, links: next });

  const patchLink = (index: number, next: LinkValue) => {
    const copy = links.slice();
    copy[index] = next;
    setLinks(copy);
  };

  const addLink = () => {
    if (links.length >= MAX_LINKS) return;
    setLinks([...links, { ...EMPTY_LINK }]);
  };

  const removeLink = (index: number) => {
    if (links.length <= MIN_LINKS) return;
    setLinks(links.filter((_, i) => i !== index));
  };

  const moveLink = (from: number, to: number) => {
    if (from < 0 || to < 0 || from >= links.length || to >= links.length) return;
    if (from === to) return;
    const next = links.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x as LinkValue);
    setLinks(next);
  };

  return (
    <Stack spacing={2} data-testid="block-links">
      <Box>
        <Typography variant="caption" color="text.secondary">
          Style
        </Typography>
        <Select
          size="small"
          value={style}
          onChange={(e) => onChange({ ...value, style: e.target.value })}
          fullWidth
          data-testid="block-links-style"
        >
          {STYLES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Links
        </Typography>
        <Stack spacing={2} data-testid="block-links-list">
          {links.map((link, i) => (
            <Box
              key={i}
              sx={{ border: "1px solid", borderColor: "divider", p: 1 }}
              data-testid={`block-links-item-${i}`}
            >
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                useFlexGap
                flexWrap="wrap"
                sx={{ mb: 1 }}
              >
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Link {i + 1}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => moveLink(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move link ${i + 1} up`}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => moveLink(i, i + 1)}
                  disabled={i === links.length - 1}
                  aria-label={`Move link ${i + 1} down`}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => removeLink(i)}
                  disabled={links.length <= MIN_LINKS}
                  aria-label={`Remove link ${i + 1}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
              <LinkControl
                label={`Link ${i + 1}`}
                value={link}
                onChange={(next) => patchLink(i, next)}
                testId={`block-links-control-${i}`}
              />
            </Box>
          ))}
        </Stack>
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            onClick={addLink}
            disabled={links.length >= MAX_LINKS}
          >
            Add link
          </Button>
        </Box>
      </Box>
    </Stack>
  );
}
