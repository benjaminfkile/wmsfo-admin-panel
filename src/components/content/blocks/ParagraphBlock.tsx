import { Stack } from "@mui/material";
import InlineText from "../InlineText";

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
      <InlineText
        value={text}
        onChange={(next) => onChange({ ...value, text: next })}
        label="Text"
        maxLength={5000}
        multiline
        minRows={3}
      />
    </Stack>
  );
}
