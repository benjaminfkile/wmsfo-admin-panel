import {
  Box,
  Button,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { FieldProps } from "@rjsf/utils";

type Block = { kind: string; [k: string]: unknown };

const BLOCK_KINDS: { value: string; label: string }[] = [
  { value: "heading", label: "Heading" },
  { value: "paragraph", label: "Paragraph" },
  { value: "list", label: "List" },
  { value: "quote", label: "Quote" },
  { value: "media", label: "Media" },
  { value: "links", label: "Links" },
  { value: "icon", label: "Icon" },
  { value: "divider", label: "Divider" },
];

function defaultBlock(kind: string): Block {
  switch (kind) {
    case "heading":
      return { kind, level: 2, text: "Heading", icon: null };
    case "paragraph":
      return { kind, text: "" };
    case "list":
      return { kind, style: "bullet", icon: null, items: [""] };
    case "quote":
      return { kind, text: "", attribution: null };
    case "media":
      return {
        kind,
        media: { mediaId: "", alt: null },
        caption: null,
        size: "medium",
      };
    case "links":
      return { kind, links: [], style: "buttons" };
    case "icon":
      return {
        kind,
        icon: { source: "library", id: "star" },
        size: "md",
        align: "start",
      };
    case "divider":
      return { kind, style: "line" };
    default:
      return { kind };
  }
}

// The `Block[]` primitive. A sortable list of blocks with add, duplicate,
// delete, and per-kind editors. Full spec includes drag; the wire value
// stays an array of blocks.
export default function BlocksField(props: FieldProps) {
  const value: Block[] = Array.isArray(props.formData)
    ? (props.formData as Block[])
    : [];

  const setBlocks = (next: Block[]) =>
    props.onChange(next as unknown, props.fieldPathId.path);

  const add = (kind: string) => setBlocks([...value, defaultBlock(kind)]);
  const remove = (i: number) => setBlocks(value.filter((_, j) => j !== i));
  const duplicate = (i: number) => {
    const b = value[i];
    if (!b) return;
    const next = [...value];
    next.splice(i + 1, 0, { ...b });
    setBlocks(next);
  };
  const patch = (i: number, partial: Partial<Block>) => {
    const next = [...value];
    next[i] = { ...(next[i] ?? { kind: "paragraph" }), ...partial };
    setBlocks(next);
  };

  return (
    <Box sx={{ my: 1 }} data-testid="blocks-field">
      <Typography variant="subtitle2">Blocks</Typography>
      <Stack spacing={2} sx={{ my: 1 }}>
        {value.map((b, i) => (
          <Box
            key={i}
            sx={{ border: "1px solid", borderColor: "divider", p: 1 }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">{b.kind}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button size="small" onClick={() => duplicate(i)}>
                Duplicate
              </Button>
              <Button size="small" color="error" onClick={() => remove(i)}>
                Delete
              </Button>
            </Stack>
            <Divider sx={{ my: 1 }} />
            {b.kind === "paragraph" || b.kind === "heading" || b.kind === "quote" ? (
              <TextField
                size="small"
                label="Text"
                fullWidth
                value={typeof b.text === "string" ? b.text : ""}
                onChange={(e) => patch(i, { text: e.target.value })}
              />
            ) : null}
          </Box>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2">Add block:</Typography>
        <Select
          size="small"
          value=""
          displayEmpty
          onChange={(e) => {
            const kind = String(e.target.value);
            if (kind) add(kind);
          }}
          data-testid="blocks-add"
        >
          <MenuItem value="">Choose…</MenuItem>
          {BLOCK_KINDS.map((k) => (
            <MenuItem key={k.value} value={k.value}>
              {k.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>
    </Box>
  );
}
