import {
  Box,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Presentation } from "../../api/types";

interface Props {
  value?: Presentation | null;
  onChange: (next: Presentation) => void;
  disabled?: boolean;
}

// The `Presentation` primitive as an editor panel (admin.md 6.14). The
// full spec adds icon and media pickers and an overlay slider; the wire
// value stays a plain object shaped by `PresentationDto`.
const WIDTHS = ["full", "wide", "narrow"];
const ALIGNS = ["start", "center"];
const SPACINGS = ["tight", "normal", "loose"];
const BG_TOKENS = ["surface", "muted", "accent", "night"];

export default function PresentationPanel({ value, onChange, disabled }: Props) {
  const current: Presentation = value ?? {
    width: "wide",
    align: "start",
    background: { kind: "none" },
    spacing: "normal",
    iconBefore: null,
    iconAfter: null,
    anchor: null,
  };
  const bg = current.background as
    | { kind: "none" }
    | { kind: "token"; token: string }
    | { kind: "media"; media: unknown; overlay: number }
    | undefined;

  const patch = (partial: Partial<Presentation>) => {
    onChange({ ...current, ...partial });
  };

  const setBgKind = (kind: string) => {
    if (kind === "none") patch({ background: { kind: "none" } as unknown as Presentation["background"] });
    if (kind === "token")
      patch({
        background: { kind: "token", token: "surface" } as unknown as Presentation["background"],
      });
    if (kind === "media")
      patch({
        background: {
          kind: "media",
          media: { mediaId: "", alt: null },
          overlay: 0,
        } as unknown as Presentation["background"],
      });
  };

  return (
    <Box data-testid="presentation-panel">
      <Typography variant="subtitle2" gutterBottom>
        Presentation
      </Typography>
      <Stack spacing={1}>
        <TextField
          select
          size="small"
          label="Width"
          value={String(current.width ?? "wide")}
          onChange={(e) => patch({ width: e.target.value as Presentation["width"] })}
          disabled={disabled}
        >
          {WIDTHS.map((w) => (
            <MenuItem key={w} value={w}>
              {w}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Align"
          value={String(current.align ?? "start")}
          onChange={(e) => patch({ align: e.target.value as Presentation["align"] })}
          disabled={disabled}
        >
          {ALIGNS.map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Spacing"
          value={String(current.spacing ?? "normal")}
          onChange={(e) => patch({ spacing: e.target.value as Presentation["spacing"] })}
          disabled={disabled}
        >
          {SPACINGS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Background"
          value={bg?.kind ?? "none"}
          onChange={(e) => setBgKind(e.target.value)}
          disabled={disabled}
        >
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="token">Token</MenuItem>
          <MenuItem value="media">Media</MenuItem>
        </TextField>
        {bg?.kind === "token" ? (
          <TextField
            select
            size="small"
            label="Token"
            value={bg.token}
            onChange={(e) =>
              patch({
                background: { kind: "token", token: e.target.value } as unknown as Presentation["background"],
              })
            }
            disabled={disabled}
          >
            {BG_TOKENS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField
          size="small"
          label="Anchor"
          value={current.anchor ?? ""}
          onChange={(e) => patch({ anchor: e.target.value === "" ? null : e.target.value })}
          disabled={disabled}
        />
      </Stack>
    </Box>
  );
}
