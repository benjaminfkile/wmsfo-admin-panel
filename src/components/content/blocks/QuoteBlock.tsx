import { Stack, TextField } from "@mui/material";

type BlockLike = { kind: string; [k: string]: unknown };

interface Props {
  value: BlockLike;
  onChange: (next: BlockLike) => void;
}

// The quote block editor. Text (Inline) and Attribution (Inline
// nullable; an empty value is stored as null).
export default function QuoteBlockEditor({ value, onChange }: Props) {
  const text = typeof value.text === "string" ? value.text : "";
  const attribution =
    typeof value.attribution === "string" ? value.attribution : "";
  return (
    <Stack spacing={2} data-testid="block-quote">
      <TextField
        size="small"
        label="Text"
        value={text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        fullWidth
        multiline
        minRows={2}
        inputProps={{ maxLength: 5000 }}
      />
      <TextField
        size="small"
        label="Attribution (optional)"
        value={attribution}
        onChange={(e) => {
          const next = e.target.value;
          onChange({ ...value, attribution: next === "" ? null : next });
        }}
        fullWidth
        inputProps={{ maxLength: 5000 }}
        data-testid="block-quote-attribution"
      />
    </Stack>
  );
}
