import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppDialog from "../../components/AppDialog";
import ErrorAlert from "../../components/ErrorAlert";
import MediaPicker from "../../components/content/MediaPicker";
import MediaPreview from "../../components/content/MediaPreview";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";
import HelpButton from "../../help/HelpButton";
import type { HelpKey } from "../../help/helpKeys";
import { useCompact } from "../../hooks/useCompact";
import { useNotify } from "../../hooks/useNotify";
import { useConfig } from "../../ConfigContext";
import { keys } from "../../queries/keys";
import { media as mediaApi } from "../../api/resources/media";
import { themes as themesApi } from "../../api/resources/themes";
import { uploadToS3 } from "../../api/resources/upload";
import { routeBasemapBase } from "../../routeMap";
import { themeStyleQuery } from "../../routeMap/themeStyle";
import type { TrackerTheme } from "../../api/types";
import { CONTRAST_PAIRS, contrastRatio, formatRatio, isHexColour, passes } from "./contrast";
import { checkStyle, type Renderer } from "./styleCheck";
import { SPRITE_FILES, readSpriteSet, uploadSprite, type SpriteSet } from "./sprite";
import { readText } from "./readFile";
import ThemePreview, { type CaptureThumbnail } from "./ThemePreview";
import {
  CHROME_KEYS,
  CHROME_LABELS,
  CONTRAST_RULE,
  KEY_HELPER,
  OVERLAY_COLOUR_KEYS,
  OVERLAY_LABELS,
  OVERLAY_OPACITY_KEYS,
  RENDERER_LABELS,
  contrastPasses,
  createBody,
  createForm,
  defaultFlips,
  editPatch,
  initialForm,
  nextSortOrder,
  previewOverlay,
  replacesCaption,
  serverFieldErrors,
  validate,
  type FieldErrors,
  type ThemeForm,
} from "./themeForm";

interface Props {
  // The theme being edited, or null for a new theme.
  theme: TrackerTheme | null;
  onClose: () => void;
}

export const PLACES_HELPER =
  'Layers that draw places carry "metadata": { "wmsfo:places": true }; the tracker shows them for the place kinds Site settings picks.';

type StyleFile = { file: File; text: string };

function sizeText(bytes: number): string {
  return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
}

// The theme editor (admin.md 6.28): the preview on the left (above on
// compact) and the fields on the right. It mounts only while open, so
// each open starts from the saved row. Save creates or patches the
// theme, then sends the sprite set and the flipped default flags.
export default function ThemeEditorDialog({ theme, onClose }: Props) {
  const qc = useQueryClient();
  const notify = useNotify();
  const compact = useCompact();
  const config = useConfig();
  const start = useMemo(() => initialForm(theme), [theme]);
  const [form, setForm] = useState<ThemeForm>(start);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [styleFile, setStyleFile] = useState<StyleFile | null>(null);
  const [spriteSet, setSpriteSet] = useState<SpriteSet | null>(null);
  const [spriteError, setSpriteError] = useState<string | null>(null);
  const [replacingSprite, setReplacingSprite] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const captureRef = useRef<CaptureThumbnail | null>(null);
  // The row a create wrote, so a retry after a failed sprite or default
  // step does not create it twice.
  const created = useRef<TrackerTheme | null>(null);
  const styleInput = useRef<HTMLInputElement>(null);
  const spriteInput = useRef<HTMLInputElement>(null);

  const themesQ = useQuery({ queryKey: keys.themes, queryFn: () => themesApi.list() });
  const allThemes = themesQ.data?.items ?? [];

  const savedStyleQ = useQuery({
    ...themeStyleQuery(theme?.styleUrl ?? ""),
    enabled: theme !== null && typeof theme.styleUrl === "string" && theme.styleUrl !== "",
  });

  const renderer = form.renderer;
  const check = useMemo(
    () => (styleFile === null ? null : checkStyle(renderer, styleFile.text)),
    [styleFile, renderer],
  );
  const previewBody: unknown =
    check?.ok === true ? check.style : check === null && theme ? (savedStyleQ.data ?? null) : null;
  const overlay = useMemo(() => previewOverlay(form.overlay), [form.overlay]);
  const chromeOk = contrastPasses(form.chrome);

  const clearError = (path: string) =>
    setErrors((e) => {
      if (!(path in e)) return e;
      const next = { ...e };
      delete next[path];
      return next;
    });
  const set = <K extends keyof ThemeForm>(k: K, v: ThemeForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    clearError(k);
  };
  const setChrome = (k: keyof ThemeForm["chrome"], v: string) => {
    setForm((f) => ({ ...f, chrome: { ...f.chrome, [k]: v } }));
    clearError(`chrome.${k}`);
  };
  const setOverlay = (k: keyof ThemeForm["overlay"], v: string) => {
    setForm((f) => ({ ...f, overlay: { ...f.overlay, [k]: v } }));
    clearError(`overlay.${k}`);
  };

  const takeStyleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await readText(file);
    setStyleFile({ file, text });
    clearError("style");
  };

  const takeSpriteFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const result = await readSpriteSet(list);
    if (typeof result === "string") {
      setSpriteSet(null);
      setSpriteError(result);
    } else {
      setSpriteSet(result);
      setSpriteError(null);
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      let saved: TrackerTheme;
      if (theme === null) {
        if (created.current) {
          saved = created.current;
        } else {
          const body = createBody(
            form,
            check?.ok ? check.style : null,
            nextSortOrder(allThemes, renderer),
          );
          saved = await themesApi.createForm(createForm(body, styleFile!.file));
          created.current = saved;
        }
      } else {
        const patch = editPatch(start, form, check?.ok ? check.style : undefined);
        saved =
          Object.keys(patch).length > 0 ? await themesApi.patch(Number(theme.id), patch) : theme;
      }
      const id = Number(saved.id);
      if (renderer === "maplibre" && spriteSet !== null) await uploadSprite(id, spriteSet);
      const flips = defaultFlips(theme === null ? null : start, form);
      if (flips !== null) await themesApi.setDefault(id, flips);
    },
    onSuccess: () => {
      notify("Theme saved");
      void qc.invalidateQueries({ queryKey: keys.themes });
      onClose();
    },
    onError: (e) => {
      if (created.current) void qc.invalidateQueries({ queryKey: keys.themes });
      setErrors(serverFieldErrors(e, renderer));
    },
  });

  const submit = () => {
    const hasStyle = check?.ok === true || (theme !== null && check === null);
    const next = validate(form, hasStyle);
    if (check && !check.ok) next.style = check.reason;
    const key = form.key.trim();
    const taken = allThemes.some(
      (t) =>
        t.renderer === renderer &&
        t.key === key &&
        (theme === null || Number(t.id) !== Number(theme.id)),
    );
    if (!next.key && taken) next.key = `A ${RENDERER_LABELS[renderer]} theme with this key exists`;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    saveMut.mutate();
  };

  const renderThumbnail = async () => {
    setRenderError(null);
    const capture = captureRef.current;
    if (!capture) {
      setRenderError("The preview is not ready yet.");
      return;
    }
    setRendering(true);
    try {
      const blob = await capture();
      const key = form.key.trim() || "new";
      const name = form.name.trim() || key;
      const filename = `theme-${key}.png`;
      const ticket = await mediaApi.uploadUrl({
        filename,
        contentType: "image/png",
        sizeBytes: blob.size,
        alt: `${name} tracker theme`,
        title: name,
      });
      const mediaId = typeof ticket.media?.id === "string" ? ticket.media.id : null;
      if (!ticket.uploadUrl || !mediaId) throw new Error("Upload ticket incomplete");
      await uploadToS3(ticket, new File([blob], filename, { type: "image/png" }), () => undefined);
      const ready = await mediaApi.confirm(mediaId);
      set("thumbnailMediaId", typeof ready.id === "string" ? ready.id : mediaId);
      void qc.invalidateQueries({ queryKey: ["media"] });
    } catch (e) {
      setRenderError(
        `The thumbnail could not be made. ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setRendering(false);
    }
  };

  const busy = saveMut.isPending;
  const shownFieldErrors = Object.keys(errors).length > 0;
  const preventDefault = (e: DragEvent) => e.preventDefault();
  const base = routeBasemapBase(config);

  const fields = (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      {saveMut.error && !shownFieldErrors ? <ErrorAlert error={saveMut.error} /> : null}

      {theme === null ? (
        <Box>
          <Typography variant="subtitle2" component="div" id="theme-renderer-label">
            Renderer
          </Typography>
          <RadioGroup
            row
            aria-labelledby="theme-renderer-label"
            value={renderer}
            onChange={(e) => set("renderer", e.target.value as Renderer)}
          >
            <FormControlLabel value="google" control={<Radio />} label="Google Maps" />
            <FormControlLabel value="maplibre" control={<Radio />} label="MapLibre" />
          </RadioGroup>
        </Box>
      ) : (
        <Typography variant="body2" data-testid="theme-renderer">
          Renderer: {RENDERER_LABELS[renderer]}
        </Typography>
      )}

      <TextField
        label="Key"
        value={form.key}
        onChange={(e) => set("key", e.target.value)}
        error={Boolean(errors.key)}
        helperText={errors.key ?? KEY_HELPER}
        slotProps={{ htmlInput: { style: { fontFamily: "monospace" } } }}
        required
      />
      <TextField
        label="Name"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        error={Boolean(errors.name)}
        helperText={errors.name}
        required
      />

      <Section title="Style file" help="themes.style-file">
        <Box
          data-testid="style-drop-zone"
          onDragOver={preventDefault}
          onDrop={(e) => {
            e.preventDefault();
            void takeStyleFile(e.dataTransfer.files[0]);
          }}
          sx={{
            border: 2,
            borderStyle: "dashed",
            borderColor: errors.style || check?.ok === false ? "error.main" : "divider",
            borderRadius: 1,
            p: 2,
            textAlign: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Drop one {renderer === "google" ? "Google Maps styles array" : "MapLibre style"} JSON
            file here
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => styleInput.current?.click()}
          >
            Choose file
          </Button>
          <input
            ref={styleInput}
            type="file"
            hidden
            accept=".json,application/json"
            aria-label="Style file"
            data-testid="style-file-input"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              void takeStyleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </Box>
        {check?.ok === false ? (
          <FormHelperText error data-testid="style-error">
            {check.reason}
          </FormHelperText>
        ) : errors.style ? (
          <FormHelperText error data-testid="style-error">
            {errors.style}
          </FormHelperText>
        ) : check?.ok === true && styleFile ? (
          <FormHelperText data-testid="style-summary">
            {styleFile.file.name}: {sizeText(styleFile.file.size)}, {check.layerCount}{" "}
            {renderer === "google" ? "rules" : "layers"}
          </FormHelperText>
        ) : theme !== null ? (
          <FormHelperText data-testid="style-summary">
            The saved style ({sizeText(Number(theme.styleBytes ?? 0))}) stays until a new file is
            dropped.
          </FormHelperText>
        ) : null}
        {renderer === "maplibre" ? <FormHelperText>{PLACES_HELPER}</FormHelperText> : null}
      </Section>

      {renderer === "maplibre" ? (
        <Section title="Sprite files" help="themes.sprite">
          {theme?.spriteSha256 && spriteSet === null && !replacingSprite ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" data-testid="sprite-current">
                Sprite: 4 files
              </Typography>
              <Button size="small" onClick={() => setReplacingSprite(true)}>
                Replace
              </Button>
            </Stack>
          ) : (
            <Box
              data-testid="sprite-drop-zone"
              onDragOver={preventDefault}
              onDrop={(e) => {
                e.preventDefault();
                void takeSpriteFiles(e.dataTransfer.files);
              }}
              sx={{
                border: 2,
                borderStyle: "dashed",
                borderColor: spriteError ? "error.main" : "divider",
                borderRadius: 1,
                p: 2,
                textAlign: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Drop the four files {SPRITE_FILES.join(", ")} here (optional)
              </Typography>
              <Button size="small" variant="outlined" onClick={() => spriteInput.current?.click()}>
                Choose files
              </Button>
              <input
                ref={spriteInput}
                type="file"
                hidden
                multiple
                accept=".json,.png,application/json,image/png"
                aria-label="Sprite files"
                data-testid="sprite-file-input"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  void takeSpriteFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </Box>
          )}
          {spriteError ? (
            <FormHelperText error data-testid="sprite-error">
              {spriteError}
            </FormHelperText>
          ) : spriteSet !== null ? (
            <FormHelperText data-testid="sprite-summary">
              4 sprite files, sent on Save
            </FormHelperText>
          ) : null}
        </Section>
      ) : null}

      <Section title="Chrome" help="themes.chrome">
        <ColourGrid>
          {CHROME_KEYS.map((k) => (
            <ColourField
              key={k}
              name={`chrome.${k}`}
              label={CHROME_LABELS[k]}
              value={form.chrome[k]}
              error={errors[`chrome.${k}`]}
              onChange={(v) => setChrome(k, v)}
            />
          ))}
        </ColourGrid>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {CONTRAST_PAIRS.map((p) => {
            const ratio = contrastRatio(form.chrome[p.fg].trim(), form.chrome[p.bg].trim());
            const ok = passes(ratio);
            return (
              <Typography
                key={p.fg}
                variant="body2"
                data-testid={`contrast-${p.fg}`}
                data-pass={ok ? "true" : "false"}
                sx={{ color: ok ? "success.main" : "error.main" }}
              >
                {p.label} {ratio === null ? "?" : formatRatio(ratio)}:1
                {ok ? "" : `. ${CONTRAST_RULE}`}
              </Typography>
            );
          })}
        </Stack>
      </Section>

      <Section title="Overlay" help="themes.overlay">
        <ColourGrid>
          {OVERLAY_COLOUR_KEYS.map((k) => (
            <ColourField
              key={k}
              name={`overlay.${k}`}
              label={OVERLAY_LABELS[k]}
              value={form.overlay[k]}
              error={errors[`overlay.${k}`]}
              onChange={(v) => setOverlay(k, v)}
            />
          ))}
          {OVERLAY_OPACITY_KEYS.map((k) => (
            <TextField
              key={k}
              size="small"
              type="number"
              label={OVERLAY_LABELS[k]}
              value={form.overlay[k]}
              onChange={(e) => setOverlay(k, e.target.value)}
              error={Boolean(errors[`overlay.${k}`])}
              helperText={errors[`overlay.${k}`]}
              slotProps={{ htmlInput: { min: 0, max: 1, step: 0.05 } }}
            />
          ))}
        </ColourGrid>
      </Section>

      <Section title="Thumbnail" help="themes.thumbnail">
        <Stack spacing={1}>
          {form.thumbnailMediaId ? (
            <Box data-testid="thumbnail-value" data-media-id={form.thumbnailMediaId}>
              <MediaPreview mediaId={form.thumbnailMediaId} />
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" data-testid="thumbnail-empty">
              No thumbnail
            </Typography>
          )}
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button size="small" onClick={() => setPickerOpen(true)}>
              Choose from the media library
            </Button>
            <Button
              size="small"
              disabled={form.thumbnailMediaId === null}
              onClick={() => set("thumbnailMediaId", null)}
            >
              Clear
            </Button>
            {renderer === "maplibre" ? (
              <Button
                size="small"
                variant="outlined"
                disabled={rendering || previewBody === null || base === null}
                onClick={() => void renderThumbnail()}
              >
                {rendering ? "Rendering..." : "Render thumbnail"}
              </Button>
            ) : null}
          </Stack>
          {renderError ? (
            <FormHelperText error data-testid="thumbnail-error">
              {renderError}
            </FormHelperText>
          ) : null}
          {errors.thumbnailMediaId ? (
            <FormHelperText error>{errors.thumbnailMediaId}</FormHelperText>
          ) : null}
        </Stack>
      </Section>

      <Section title="Defaults" help="themes.defaults">
        {(["light", "dark"] as const).map((mode) => {
          const k = mode === "light" ? "defaultLight" : "defaultDark";
          const caption = replacesCaption(allThemes, theme, renderer, mode, form[k]);
          return (
            <Box key={mode}>
              <FormControlLabel
                control={
                  <Switch checked={form[k]} onChange={(e) => set(k, e.target.checked)} />
                }
                label={mode === "light" ? "Default in light mode" : "Default in dark mode"}
              />
              {caption ? (
                <FormHelperText data-testid={`default-${mode}-caption`} sx={{ mt: 0 }}>
                  {caption}
                </FormHelperText>
              ) : null}
            </Box>
          );
        })}
      </Section>
    </Stack>
  );

  return (
    <AppDialog
      open
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            m: { sm: 4 },
            width: { sm: "calc(100% - 64px)" },
            maxWidth: { sm: "none" },
            height: { sm: "calc(100% - 64px)" },
            maxHeight: { sm: "none" },
          },
        },
      }}
    >
      <DialogTitleWithHelp help="themes.editor">
        {theme ? `Edit ${theme.name ?? "theme"}` : "New theme"}
      </DialogTitleWithHelp>
      <DialogContent dividers>
        <Stack
          direction={compact ? "column" : "row"}
          spacing={3}
          alignItems="flex-start"
          data-testid="theme-editor-layout"
          data-layout={compact ? "stacked" : "side-by-side"}
        >
          <Box sx={{ flex: 3, minWidth: 0, width: compact ? "100%" : undefined }}>
            <ThemePreview
              renderer={renderer}
              style={previewBody}
              chrome={form.chrome}
              overlay={overlay}
              captureRef={captureRef}
            />
            {theme && savedStyleQ.error && check === null ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                The saved style could not load.
              </Alert>
            ) : null}
          </Box>
          <Box sx={{ flex: 2, minWidth: 0, width: compact ? "100%" : undefined }}>{fields}</Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy || !chromeOk}>
          Save
        </Button>
      </DialogActions>
      <MediaPicker
        open={pickerOpen}
        kind="raster"
        title="Choose a thumbnail"
        onCancel={() => setPickerOpen(false)}
        onPick={(asset) => {
          setPickerOpen(false);
          if (typeof asset.id === "string") set("thumbnailMediaId", asset.id);
        }}
      />
    </AppDialog>
  );
}

function Section({ title, help, children }: { title: string; help: HelpKey; children: ReactNode }) {
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={0.5} component="legend" sx={{ p: 0 }}>
        <Typography variant="subtitle2" component="span">
          {title}
        </Typography>
        <HelpButton topic={help} />
      </Stack>
      {children}
    </Box>
  );
}

function ColourGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 1.5,
        mt: 1,
      }}
    >
      {children}
    </Box>
  );
}

// A colour picker beside a hex field (`#rrggbb` or `#rrggbbaa`). The
// picker sets the first six digits and keeps an alpha the field holds.
function ColourField({
  name,
  label,
  value,
  error,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const valid = isHexColour(value.trim());
  const swatch = valid ? value.trim().slice(0, 7).toLowerCase() : "#000000";
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Box
        component="input"
        type="color"
        aria-label={`${label} colour`}
        value={swatch}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const alpha = valid && value.trim().length === 9 ? value.trim().slice(7) : "";
          onChange(`${e.target.value}${alpha}`);
        }}
        sx={{ width: 40, height: 40, p: 0, border: 0, background: "none", flex: "0 0 auto" }}
      />
      <TextField
        size="small"
        label={label}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={Boolean(error)}
        helperText={error}
        fullWidth
        slotProps={{ htmlInput: { style: { fontFamily: "monospace" } } }}
      />
    </Stack>
  );
}
