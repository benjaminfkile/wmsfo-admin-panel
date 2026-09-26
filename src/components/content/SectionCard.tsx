import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
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
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type { ErrorSchema, RJSFSchema } from "@rjsf/utils";
import SchemaForm from "./SchemaForm";
import PresentationPanel from "./PresentationPanel";
import ItemsEditor from "./ItemsEditor";
import ProblemList from "./ProblemList";
import MapStartView, { type MapStart } from "./fields/MapStartView";
import { sectionSummary } from "./sectionSummary";
import { useCurrentEvent } from "./useCurrentEvent";
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
  position: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onPatch: (partial: {
    data?: object;
    presentation?: Presentation;
    isHidden?: boolean;
  }) => void;
  onDuplicate?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  onCreateItem?: (data: object) => void;
  onPatchItem?: (
    id: number,
    body: Partial<{ data: object; isHidden: boolean }>
  ) => void;
  onRemoveItem?: (id: number) => void;
  onReorderItems?: (ids: number[]) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  saveState?: SaveState;
  extraErrors?: ErrorSchema;
}

// A single section card (admin.md 6.14). The tinted header holds the
// position number, kind title, summary from the data, badges, move
// arrows, and menu; clicking the header toggles the collapse. The
// Content tab renders the kind's `SchemaForm` (plus `ItemsEditor` when
// the kind has items). Presentation renders `PresentationPanel`. Edits
// schedule an autosave on a 1 s debounce.
export default function SectionCard({
  section,
  kind,
  disabled,
  position,
  expanded,
  onToggleExpanded,
  onPatch,
  onDuplicate,
  onMove,
  onDelete,
  onCreateItem,
  onPatchItem,
  onRemoveItem,
  onReorderItems,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
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
  const currentEvent = useCurrentEvent();
  const summary = sectionSummary(section, kind, currentEvent);

  const stop = (fn?: () => void) => (
    e: React.MouseEvent<HTMLElement>
  ) => {
    e.stopPropagation();
    fn?.();
  };

  return (
    <Card
      variant="outlined"
      data-testid={`section-card-${section.id}`}
      sx={{ borderColor: "divider" }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Section ${position}: ${kind.title ?? ""}`}
        onClick={onToggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpanded();
          }
        }}
        data-testid={`section-header-${section.id}`}
        sx={{
          bgcolor: "action.hover",
          px: 2,
          py: 1,
          cursor: "pointer",
          borderBottom: expanded ? "1px solid" : "none",
          borderColor: "divider",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
        >
          <IconButton
            size="small"
            aria-label={expanded ? "Collapse section" : "Expand section"}
            onClick={stop(onToggleExpanded)}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, minWidth: 0 }}
                data-testid={`section-title-${section.id}`}
              >
                {position} · {kind.title}
              </Typography>
              {kind.live ? (
                <Chip size="small" label="Live" color="info" />
              ) : null}
              {section.isHidden ? (
                <Chip size="small" label="Hidden" color="default" />
              ) : null}
              {problemCount > 0 ? (
                <Badge
                  badgeContent={problemCount}
                  color="error"
                  overlap="rectangular"
                  data-testid={`section-problems-${section.id}`}
                  sx={{ ml: 1 }}
                >
                  <span />
                </Badge>
              ) : (
                <Badge
                  badgeContent={0}
                  showZero={false}
                  data-testid={`section-problems-${section.id}`}
                >
                  <span />
                </Badge>
              )}
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
            </Stack>
            {summary ? (
              <Typography
                variant="body2"
                color="text.secondary"
                data-testid={`section-summary-${section.id}`}
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {summary}
              </Typography>
            ) : null}
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
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
              size="small"
              onClick={stop(onMoveUp)}
              disabled={!canMoveUp}
              aria-label="Move section up"
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={stop(onMoveDown)}
              disabled={!canMoveDown}
              aria-label="Move section down"
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor(e.currentTarget);
              }}
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
        </Stack>
      </Box>
      <Collapse in={expanded} unmountOnExit={false}>
        <CardContent>
          <Tabs
            value={tab}
            onChange={(_, v: "content" | "presentation") => setTab(v)}
          >
            <Tab label="Content" value="content" />
            <Tab label="Presentation" value="presentation" />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {tab === "content" ? (
              schema ? (
                <>
                  {kind.kind === "map" ? (
                    <MapStartView
                      value={data as MapStart}
                      onChange={(next) => setData({ ...data, ...next })}
                      disabled={disabled}
                    />
                  ) : null}
                  <SchemaForm
                    schema={schema}
                    kind={kind.kind}
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
                sectionKind={kind.kind}
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
        </CardContent>
      </Collapse>
    </Card>
  );
}
