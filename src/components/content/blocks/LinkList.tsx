import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import LinkControl from "./LinkControl";
import type { LinkPartLabels, LinkValue } from "./LinkControl";
import { EMPTY_LINK, linkBoundsHint } from "./linkValues";

interface Props {
  links: LinkValue[];
  onChange: (next: LinkValue[]) => void;
  min: number;
  max: number;
  // The name of one entry; entries are titled "<itemLabel> <n>".
  itemLabel?: string;
  partLabels?: LinkPartLabels;
  // Prefix of the list's test ids: `<prefix>-list`, `<prefix>-item-<i>`,
  // `<prefix>-control-<i>`, `<prefix>-add`, `<prefix>-hint`.
  testIdPrefix: string;
}

// A list of LinkControl cards, each with up, down, and remove, and an
// "Add link" button that appends an empty link. Add is disabled at
// `max` and remove at `min`; the bounds show as a hint under the list.
export default function LinkList({
  links,
  onChange,
  min,
  max,
  itemLabel = "Link",
  partLabels,
  testIdPrefix,
}: Props) {
  const patchLink = (index: number, next: LinkValue) => {
    const copy = links.slice();
    copy[index] = next;
    onChange(copy);
  };

  const addLink = () => {
    if (links.length >= max) return;
    onChange([...links, { ...EMPTY_LINK }]);
  };

  const removeLink = (index: number) => {
    if (links.length <= min) return;
    onChange(links.filter((_, i) => i !== index));
  };

  const moveLink = (from: number, to: number) => {
    if (from < 0 || to < 0 || from >= links.length || to >= links.length) return;
    if (from === to) return;
    const next = links.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x as LinkValue);
    onChange(next);
  };

  const hint = linkBoundsHint(min, max);

  return (
    <Box>
      <Stack spacing={2} data-testid={`${testIdPrefix}-list`}>
        {links.map((link, i) => (
          <Box
            key={i}
            sx={{ border: "1px solid", borderColor: "divider", p: 1, minWidth: 0 }}
            data-testid={`${testIdPrefix}-item-${i}`}
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
                {itemLabel} {i + 1}
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
                disabled={links.length <= min}
                aria-label={`Remove link ${i + 1}`}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
            <LinkControl
              label={`${itemLabel} ${i + 1}`}
              value={link}
              onChange={(next) => patchLink(i, next)}
              partLabels={partLabels}
              testId={`${testIdPrefix}-control-${i}`}
            />
          </Box>
        ))}
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ mt: 1 }}
      >
        <Button
          size="small"
          onClick={addLink}
          disabled={links.length >= max}
          data-testid={`${testIdPrefix}-add`}
        >
          Add link
        </Button>
        {hint ? (
          <Typography
            variant="caption"
            color="text.secondary"
            data-testid={`${testIdPrefix}-hint`}
          >
            {hint}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
