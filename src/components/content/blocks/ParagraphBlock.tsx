import { Stack, TextField } from "@mui/material";

type BlockLike = { kind: string; [k: string]: unknown };

interface Props {
  value: BlockLike;
  onChange: (next: BlockLike) => void;
}

// The paragraph block editor. Multiline text (Inline).
export default function ParagraphBlockEditor({ value, onChange }: Props) {
  const text = typeof value.text === "string" ? value.text : "";
  return (
    <Stack spacing={2} data-testid="block-paragraph">
      <TextField
        size="small"
        label="Text"
        value={text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        fullWidth
        multiline
        minRows={3}
        inputProps={{ maxLength: 5000 }}
      />
    </Stack>
  );
}
