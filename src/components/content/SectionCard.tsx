import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { ErrorSchema, RJSFSchema } from "@rjsf/utils";
import SchemaForm from "./SchemaForm";
import PresentationPanel from "./PresentationPanel";
import ItemsEditor from "./ItemsEditor";
import ProblemList from "./ProblemList";
import type {
  KindInfo,
  Presentation,
  SectionAdmin,
  SectionItemAdmin,
} from "../../api/types";
import { useDebouncedSave } from "../../hooks/useDebouncedSave";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  section: SectionAdmin;
  kind: KindInfo;
  disabled?: boolean;
  onPatch: (partial: {
    data?: object;
    presentation?: Presentation;
    isHidden?: boolean;
  }) => void;
  onDuplicate?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  onCreateItem?: (data: object) => void;
  onPatchItem?: (id: number, data: object) => void;
  onRemoveItem?: (id: number) => void;
  onReorderItems?: (ids: number[]) => void;
  saveState?: SaveState;
  extraErrors?: ErrorSchema;
}

// A single section card (admin.md 6.14). Content tab renders the kind's
// `SchemaForm` (and `ItemsEditor` when the kind has items). Presentation
// tab shows the `PresentationPanel`. Edits schedule an autosave on a 1 s
// debounce.
export default function SectionCard({
  section,
  kind,
  disabled,
  onPatch,
  onDuplicate,
  onMove,
  onDelete,
  onCreateItem,
  onPatchItem,
  onRemoveItem,
  onReorderItems,
  saveState = "idle",
  extraErrors,
}: Props) {
  const [tab, setTab] = useState<"content" | "presentation">("content");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<object>(
    typeof section.data === "object" && section.data !== null
      ? (section.data as object)
      : {}
  );
  const [presentation, setPresentation] = useState<Presentation>(
    (section.presentation ?? {
      width: "wide",
      align: "start",
      background: { kind: "none" },
      spacing: "normal",
      iconBefore: null,
      iconAfter: null,
      anchor: null,
    }) as Presentation
  );

  const debouncedData = useDebouncedSave<object>((v) =>
    onPatch({ data: v })
  );
  const debouncedPres = useDebouncedSave<Presentation>((v) =>
    onPatch({ presentation: v })
  );

  const initial = useRef(true);
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    debouncedData.schedule(data);
  }, [data, debouncedData]);

  useEffect(() => {
    return () => {
      debouncedData.flush();
      debouncedPres.flush();
    };
  }, [debouncedData, debouncedPres]);

  const items: SectionItemAdmin[] = section.items ?? [];
  const problems = section.problems ?? [];
  const problemCount = problems.length;
  const schema = (kind.schema ?? null) as RJSFSchema | null;

  return (
    <Box
      sx={{ border: "1px solid", borderColor: "divider", p: 2, mb: 2 }}
      data-testid={`section-card-${section.id}`}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h6">{kind.title}</Typography>
        {kind.live ? <Chip size="small" label="Live" color="info" /> : null}
        <Box sx={{ flexGrow: 1 }} />
        {saveState === "saving" ? (
          <Typography variant="caption" color="text.secondary">
            Saving…
          </Typography>
        ) : saveState === "saved" ? (
          <Typography variant="caption" color="success.main">
            Saved
          </Typography>
        ) : saveState === "error" ? (
          <Typography variant="caption" color="error.main">
            Not saved
          </Typography>
        ) : null}
        <Badge
          badgeContent={problemCount}
          color="error"
          overlap="rectangular"
          data-testid={`section-problems-${section.id}`}
        >
          <span />
        </Badge>
        <Stack direction="row" alignItems="center">
          <Typography variant="caption">Hidden</Typography>
          <Switch
            size="small"
            checked={Boolean(section.isHidden)}
            onChange={(e) => onPatch({ isHidden: e.target.checked })}
            disabled={disabled}
            inputProps={{ "aria-label": "Hidden" }}
          />
        </Stack>
        <IconButton
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          size="small"
          aria-label="Section menu"
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDuplicate?.();
            }}
          >
            Duplicate
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onMove?.();
            }}
          >
            Move to page
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDelete?.();
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      </Stack>
      <Tabs value={tab} onChange={(_, v: "content" | "presentation") => setTab(v)}>
        <Tab label="Content" value="content" />
        <Tab label="Presentation" value="presentation" />
      </Tabs>
      <Box sx={{ mt: 2 }}>
        {tab === "content" ? (
          schema ? (
            <>
              <SchemaForm
                schema={schema}
                formData={data}
                disabled={disabled}
                onChange={(next: object) => setData(next)}
                onBlur={() => debouncedData.flush()}
                extraErrors={extraErrors}
              />
              {kind.hasItems ? (
                <ItemsEditor
                  items={items}
                  kind={kind}
                  disabled={disabled}
                  onCreate={onCreateItem ?? (() => undefined)}
                  onPatchItem={onPatchItem ?? (() => undefined)}
                  onRemoveItem={onRemoveItem ?? (() => undefined)}
                  onReorder={onReorderItems}
                />
              ) : null}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No schema for this kind.
            </Typography>
          )
        ) : (
          <PresentationPanel
            value={presentation}
            disabled={disabled}
            onChange={(next) => {
              setPresentation(next);
              debouncedPres.schedule(next);
            }}
          />
        )}
      </Box>
      <ProblemList problems={problems} />
      <Box sx={{ mt: 1 }}>
        <Button size="small" onClick={() => debouncedData.flush()}>
          Save now
        </Button>
      </Box>
    </Box>
  );
}
