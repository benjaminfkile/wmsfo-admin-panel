import { Box, Stack } from "@mui/material";
import InlineText from "../InlineText";

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
      <InlineText
        value={text}
        onChange={(next) => onChange({ ...value, text: next })}
        label="Text"
        maxLength={5000}
        multiline
        minRows={2}
      />
      <Box data-testid="block-quote-attribution">
        <InlineText
          value={attribution}
          onChange={(next) =>
            onChange({ ...value, attribution: next === "" ? null : next })
          }
          label="Attribution (optional)"
          maxLength={5000}
        />
      </Box>
    </Stack>
  );
}
