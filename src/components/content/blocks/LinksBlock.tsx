import { Box, MenuItem, Select, Stack, Typography } from "@mui/material";
import LinkList from "./LinkList";
import { toLinks } from "./linkValues";
import type { LinkValue } from "./LinkControl";

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

// The links block editor. Style select (Buttons, List) and the shared
// LinkList (cards with up, down, and remove, and "Add link"). 1 to 20
// links.
export default function LinksBlockEditor({ value, onChange }: Props) {
  const style =
    typeof value.style === "string" &&
    STYLES.some((s) => s.value === value.style)
      ? (value.style as string)
      : "buttons";
  const links = toLinks(value.links);

  const setLinks = (next: LinkValue[]) => onChange({ ...value, links: next });

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
        <LinkList
          links={links}
          onChange={setLinks}
          min={MIN_LINKS}
          max={MAX_LINKS}
          testIdPrefix="block-links"
        />
      </Box>
    </Stack>
  );
}
