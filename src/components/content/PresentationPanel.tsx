import { useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import IconPicker from "./pickers/IconPicker";
import IconPreview from "./IconPreview";
import MediaPicker from "./MediaPicker";
import MediaPreview from "./MediaPreview";
import DisplayControls from "./DisplayControls";
import { withDisplay, type Display } from "./display";
import CardOpacityFields from "./CardOpacityFields";
import {
  readOpacity,
  withOpacity,
  type CardOpacityKey,
} from "./cardOpacity";
import { CARD_OPACITY_LABELS } from "./labels";
import type { Icon, MediaAsset, MediaRef, Presentation } from "../../api/types";

interface Props {
  value?: Presentation | null;
  onChange: (next: Presentation) => void;
  disabled?: boolean;
  // The section's kind; the map kind never shows the card switch or
  // Width.
  sectionKind?: string;
}

type MediaBg = { kind: "media"; media: MediaRef; overlay: number };
type TokenBg = { kind: "token"; token: string };
type NoneBg = { kind: "none" };
type Bg = NoneBg | TokenBg | MediaBg;

const WIDTH_OPTIONS: Array<[string, string]> = [
  ["full", "Full"],
  ["wide", "Wide"],
  ["narrow", "Narrow"],
];
const ALIGN_OPTIONS: Array<[string, string]> = [
  ["start", "Start"],
  ["center", "Centre"],
];
const SPACING_OPTIONS: Array<[string, string]> = [
  ["tight", "Tight"],
  ["normal", "Normal"],
  ["loose", "Loose"],
];
const BG_KIND_OPTIONS: Array<[string, string]> = [
  ["none", "None"],
  ["token", "Colour"],
  ["media", "Image"],
];
const BG_TOKEN_OPTIONS: Array<[string, string]> = [
  ["surface", "Surface"],
  ["muted", "Muted"],
  ["accent", "Accent"],
  ["night", "Night"],
];

const ICON_SIZE_OPTIONS: Array<[string, string]> = [
  ["sm", "Small"],
  ["md", "Medium"],
  ["lg", "Large"],
  ["xl", "Extra large"],
];

// The site never shows the map in a card, so the card switch and Width
// are hidden for it.
const CARDLESS_KIND = "map";

const DEFAULT_PRES: Presentation = {
  width: "wide",
  align: "start",
  background: { kind: "none" } as unknown as Presentation["background"],
  spacing: "normal",
  iconBefore: null,
  iconAfter: null,
  anchor: null,
};

// The `Presentation` primitive as an editor panel (admin.md 6.14): a
// "Show in a card" switch (on unless `card` is false; hidden for the
// map), the card opacity pair (only with the card on), width (only with the card off), align, spacing, background
// (none, colour token, or an image with a MediaField and a Darken
// slider), icon before and icon after with the icon picker and an icon
// size, and an anchor. The background image and each icon carry the
// collapsed Advanced section (DisplayControls) for their `display`.
export default function PresentationPanel({
  value,
  onChange,
  disabled,
  sectionKind,
}: Props) {
  const current: Presentation = value ?? DEFAULT_PRES;
  const bg = (current.background ?? { kind: "none" }) as Bg;

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [pendingBgKind, setPendingBgKind] = useState<"media" | null>(null);

  useEffect(() => {
    if (!mediaPickerOpen && pendingBgKind !== null) {
      setPendingBgKind(null);
    }
  }, [mediaPickerOpen, pendingBgKind]);

  const patch = (partial: Partial<Presentation>) => {
    onChange({ ...current, ...partial });
  };

  const setOpacity = (key: CardOpacityKey, next: number | undefined) => {
    onChange(withOpacity(current, key, next));
  };

  const writeBg = (next: Bg) => {
    patch({ background: next as unknown as Presentation["background"] });
  };

  const openPicker = () => {
    setMediaPickerOpen(true);
  };

  const onBgKindChange = (kind: string) => {
    if (kind === "none") {
      writeBg({ kind: "none" });
      return;
    }
    if (kind === "token") {
      const existing =
        bg.kind === "token" ? (bg as TokenBg).token : "surface";
      writeBg({ kind: "token", token: existing });
      return;
    }
    if (kind === "media") {
      if (bg.kind === "media") {
        openPicker();
        return;
      }
      setPendingBgKind("media");
      setMediaPickerOpen(true);
    }
  };

  const onMediaPick = (asset: MediaAsset) => {
    const mediaId = typeof asset.id === "string" ? asset.id : "";
    if (!mediaId) {
      setMediaPickerOpen(false);
      return;
    }
    const existingAlt = bg.kind === "media" ? bg.media.alt ?? null : null;
    const existingOverlay = bg.kind === "media" ? bg.overlay : 0;
    const existingMedia = bg.kind === "media" ? bg.media : null;
    writeBg({
      kind: "media",
      media: { ...existingMedia, mediaId, alt: existingAlt },
      overlay: existingOverlay,
    });
    setMediaPickerOpen(false);
  };

  const onMediaCancel = () => {
    setMediaPickerOpen(false);
  };

  const setAlt = (alt: string) => {
    if (bg.kind !== "media") return;
    writeBg({
      ...bg,
      media: { ...bg.media, alt: alt === "" ? null : alt },
    });
  };

  const setMediaDisplay = (display: Display | undefined) => {
    if (bg.kind !== "media") return;
    writeBg({ ...bg, media: withDisplay(bg.media, display) });
  };

  const setOverlay = (overlay: number) => {
    if (bg.kind !== "media") return;
    writeBg({ ...bg, overlay });
  };

  const setToken = (token: string) => {
    writeBg({ kind: "token", token });
  };

  const bgKindValue = pendingBgKind ?? bg.kind ?? "none";
  const isMap = sectionKind === CARDLESS_KIND;
  const carded = current.card !== false;
  const showWidth = !isMap && !carded;
  const hasIcon = Boolean(current.iconBefore) || Boolean(current.iconAfter);

  return (
    <Box data-testid="presentation-panel">
      <Typography variant="subtitle2" gutterBottom>
        Presentation
      </Typography>
      <Stack spacing={1}>
        {isMap ? null : (
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={carded}
                  onChange={(e) => patch({ card: e.target.checked })}
                  disabled={disabled}
                  data-testid="presentation-card"
                />
              }
              label="Show in a card"
            />
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
            >
              Cards are always the standard width
            </Typography>
          </Box>
        )}
        {!isMap && carded ? (
          <CardOpacityFields
            value={{
              cardOpacityLight: readOpacity(current.cardOpacityLight),
              cardOpacityDark: readOpacity(current.cardOpacityDark),
            }}
            onChange={setOpacity}
            help={CARD_OPACITY_LABELS.cardOpacityLight?.help ?? ""}
            disabled={disabled}
            testId="presentation-card-opacity"
          />
        ) : null}
        {showWidth ? (
          <TextField
            select
            size="small"
            label="Width"
            value={String(current.width ?? "wide")}
            onChange={(e) =>
              patch({ width: e.target.value as Presentation["width"] })
            }
            disabled={disabled}
            fullWidth
            data-testid="presentation-width"
          >
            {WIDTH_OPTIONS.map(([v, l]) => (
              <MenuItem key={v} value={v}>
                {l}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField
          select
          size="small"
          label="Align"
          value={String(current.align ?? "start")}
          onChange={(e) =>
            patch({ align: e.target.value as Presentation["align"] })
          }
          disabled={disabled}
          fullWidth
        >
          {ALIGN_OPTIONS.map(([v, l]) => (
            <MenuItem key={v} value={v}>
              {l}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Spacing"
          value={String(current.spacing ?? "normal")}
          onChange={(e) =>
            patch({ spacing: e.target.value as Presentation["spacing"] })
          }
          disabled={disabled}
          fullWidth
        >
          {SPACING_OPTIONS.map(([v, l]) => (
            <MenuItem key={v} value={v}>
              {l}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Background"
          value={bgKindValue}
          onChange={(e) => onBgKindChange(e.target.value)}
          disabled={disabled}
          fullWidth
        >
          {BG_KIND_OPTIONS.map(([v, l]) => (
            <MenuItem key={v} value={v}>
              {l}
            </MenuItem>
          ))}
        </TextField>
        {bg.kind === "token" ? (
          <TextField
            select
            size="small"
            label="Colour"
            value={bg.token}
            onChange={(e) => setToken(e.target.value)}
            disabled={disabled}
            fullWidth
          >
            {BG_TOKEN_OPTIONS.map(([v, l]) => (
              <MenuItem key={v} value={v}>
                {l}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        {bg.kind === "media" ? (
          <MediaBackgroundEditor
            bg={bg}
            disabled={disabled}
            onChoose={openPicker}
            onAlt={setAlt}
            onDisplay={setMediaDisplay}
            onOverlay={setOverlay}
          />
        ) : null}
        <IconLine
          label="Icon before"
          value={(current.iconBefore ?? null) as Icon | null}
          onChange={(next) => patch({ iconBefore: next })}
          disabled={disabled}
          testId="presentation-icon-before"
        />
        <IconLine
          label="Icon after"
          value={(current.iconAfter ?? null) as Icon | null}
          onChange={(next) => patch({ iconAfter: next })}
          disabled={disabled}
          testId="presentation-icon-after"
        />
        {hasIcon ? (
          <TextField
            select
            size="small"
            label="Icon size"
            value={String(current.iconSize ?? "sm")}
            onChange={(e) => patch({ iconSize: e.target.value })}
            disabled={disabled}
            fullWidth
            data-testid="presentation-icon-size"
          >
            {ICON_SIZE_OPTIONS.map(([v, l]) => (
              <MenuItem key={v} value={v}>
                {l}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField
          size="small"
          label="Anchor (for links like /page#anchor)"
          value={current.anchor ?? ""}
          onChange={(e) =>
            patch({ anchor: e.target.value === "" ? null : e.target.value })
          }
          disabled={disabled}
          fullWidth
        />
      </Stack>
      <MediaPicker
        open={mediaPickerOpen}
        onCancel={onMediaCancel}
        onPick={onMediaPick}
      />
    </Box>
  );
}

function MediaBackgroundEditor({
  bg,
  disabled,
  onChoose,
  onAlt,
  onDisplay,
  onOverlay,
}: {
  bg: MediaBg;
  disabled?: boolean;
  onChoose: () => void;
  onAlt: (alt: string) => void;
  onDisplay: (display: Display | undefined) => void;
  onOverlay: (overlay: number) => void;
}) {
  const percent = Math.round((bg.overlay ?? 0) * 100);
  return (
    <Stack spacing={1} data-testid="presentation-media">
      <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap">
        {bg.media.mediaId ? (
          <MediaPreview mediaId={bg.media.mediaId} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No media
          </Typography>
        )}
        <Button size="small" onClick={onChoose} disabled={disabled}>
          Choose
        </Button>
      </Stack>
      <TextField
        size="small"
        label="Alt text (leave empty to use the image's own)"
        value={bg.media.alt ?? ""}
        onChange={(e) => onAlt(e.target.value)}
        disabled={disabled}
        fullWidth
      />
      {bg.media.mediaId ? (
        <DisplayControls
          value={(bg.media as { display?: unknown }).display}
          onChange={onDisplay}
          disabled={disabled}
          testId="presentation-media-display"
        />
      ) : null}
      <Box>
        <Typography variant="caption" color="text.secondary" component="div">
          Darken the image so text stays readable ({percent}%)
        </Typography>
        <Slider
          value={bg.overlay ?? 0}
          onChange={(_, v) =>
            onOverlay(typeof v === "number" ? v : (v[0] ?? 0))
          }
          min={0}
          max={1}
          step={0.05}
          disabled={disabled}
          aria-label="Darken the image so text stays readable"
          data-testid="presentation-overlay"
        />
      </Box>
    </Stack>
  );
}

function IconLine({
  label,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: Icon | null;
  onChange: (next: Icon | null) => void;
  disabled?: boolean;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box data-testid={testId}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {value ? (
          <IconPreview icon={value} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            None
          </Typography>
        )}
        <Button size="small" onClick={() => setOpen(true)} disabled={disabled}>
          Choose
        </Button>
        {value ? (
          <Button
            size="small"
            color="error"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Clear
          </Button>
        ) : null}
      </Stack>
      {value ? (
        <DisplayControls
          value={value.display}
          onChange={(d) => onChange(withDisplay(value, d))}
          disabled={disabled}
          testId={`${testId}-display`}
        />
      ) : null}
      <IconPicker
        open={open}
        onCancel={() => setOpen(false)}
        onPick={(next) => {
          setOpen(false);
          onChange(value?.display ? { ...next, display: value.display } : next);
        }}
      />
    </Box>
  );
}
