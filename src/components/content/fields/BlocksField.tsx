import {
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import type { FieldProps } from "@rjsf/utils";
import type { Icon } from "../../../api/types";
import HeadingBlockEditor from "../blocks/HeadingBlock";
import ParagraphBlockEditor from "../blocks/ParagraphBlock";
import QuoteBlockEditor from "../blocks/QuoteBlock";
import ListBlockEditor from "../blocks/ListBlock";
import DividerBlockEditor from "../blocks/DividerBlock";
import MediaBlockEditor from "../blocks/MediaBlock";
import LinksBlockEditor from "../blocks/LinksBlock";
import IconBlockEditor from "../blocks/IconBlock";
import MediaFilename from "../blocks/MediaFilename";
import IconName from "../blocks/IconName";

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

const KIND_LABELS: Record<string, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  quote: "Quote",
  list: "List",
  divider: "Divider",
  media: "Media",
  links: "Links",
  icon: "Icon",
};

const STYLE_LABELS: Record<string, string> = {
  bullet: "bullets",
  number: "numbers",
  icon: "icon",
};

const LINKS_STYLE_LABELS: Record<string, string> = {
  buttons: "buttons",
  list: "list",
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function summarize(b: Block): ReactNode {
  if (b.kind === "heading" || b.kind === "paragraph" || b.kind === "quote") {
    const t = typeof b.text === "string" ? b.text : "";
    return truncate(t, 60);
  }
  if (b.kind === "list") {
    const items = Array.isArray(b.items) ? b.items : [];
    const style =
      typeof b.style === "string" && STYLE_LABELS[b.style]
        ? STYLE_LABELS[b.style]
        : "bullets";
    return `${items.length} lines, ${style} style`;
  }
  if (b.kind === "media") {
    const media = b.media as { mediaId?: unknown } | undefined;
    const id =
      media && typeof media.mediaId === "string" ? media.mediaId : "";
    return <MediaFilename mediaId={id} />;
  }
  if (b.kind === "links") {
    const items = Array.isArray(b.links) ? b.links : [];
    const style =
      typeof b.style === "string" && LINKS_STYLE_LABELS[b.style]
        ? LINKS_STYLE_LABELS[b.style]
        : "buttons";
    return `${items.length} links, ${style}`;
  }
  if (b.kind === "icon") {
    if (b.icon && typeof b.icon === "object") {
      return <IconName icon={b.icon as Icon} />;
    }
    return "";
  }
  return "";
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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

interface RowProps {
  id: string;
  index: number;
  block: Block;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children: ReactNode;
}

function SortableBlockRow({
  id,
  index,
  block,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  children,
}: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const label = KIND_LABELS[block.kind] ?? block.kind;
  const summary = summarize(block);
  const hasSummary =
    typeof summary === "string" ? summary.length > 0 : summary !== null;
  return (
    <Box
      ref={setNodeRef}
      style={style}
      data-testid={`block-row-${index}`}
      sx={{ border: "1px solid", borderColor: "divider", p: 1 }}
    >
      <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap">
        <IconButton
          size="small"
          aria-label={`Drag ${label} block`}
          {...attributes}
          {...listeners}
          sx={{ cursor: "grab" }}
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label={`Move ${label} block up`}
        >
          <ArrowUpwardIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label={`Move ${label} block down`}
        >
          <ArrowDownwardIcon fontSize="small" />
        </IconButton>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          {hasSummary ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", wordBreak: "break-word" }}
            >
              {summary}
            </Typography>
          ) : null}
        </Box>
        <Button size="small" onClick={onDuplicate}>
          Duplicate
        </Button>
        <IconButton
          size="small"
          onClick={onRemove}
          aria-label={`Delete ${label} block`}
          color="error"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Divider sx={{ my: 1 }} />
      {children}
    </Box>
  );
}

// The `Block[]` primitive: a sortable list of blocks. Each row shows a
// human label and a summary, a drag handle, up and down arrows,
// Duplicate, and Delete; the body is a per kind editor for one of the
// eight kinds (heading, paragraph, list, quote, media, links, icon,
// divider) that reads every field of its shape and preserves anything
// it does not know.
export default function BlocksField(props: FieldProps) {
  const value: Block[] = Array.isArray(props.formData)
    ? (props.formData as Block[])
    : [];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const setBlocks = (next: Block[]) =>
    props.onChange(next as unknown, props.fieldPathId.path);

  const add = (kind: string) => setBlocks([...value, defaultBlock(kind)]);
  const remove = (i: number) => setBlocks(value.filter((_, j) => j !== i));
  const duplicate = (i: number) => {
    const b = value[i];
    if (!b) return;
    const next = [...value];
    next.splice(i + 1, 0, deepCopy(b));
    setBlocks(next);
  };
  const replaceAt = (i: number, block: Block) => {
    const next = [...value];
    next[i] = block;
    setBlocks(next);
  };
  const move = (from: number, to: number) => {
    if (
      from < 0 ||
      to < 0 ||
      from >= value.length ||
      to >= value.length ||
      from === to
    ) {
      return;
    }
    setBlocks(arrayMove(value, from, to));
  };

  const ids = value.map((_, i) => `block-${i}`);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    move(from, to);
  };

  return (
    <Box sx={{ my: 1 }} data-testid="blocks-field">
      <Typography variant="subtitle2">Blocks</Typography>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Stack spacing={2} sx={{ my: 1 }}>
            {value.map((b, i) => (
              <SortableBlockRow
                key={ids[i]}
                id={ids[i] as string}
                index={i}
                block={b}
                canMoveUp={i > 0}
                canMoveDown={i < value.length - 1}
                onMoveUp={() => move(i, i - 1)}
                onMoveDown={() => move(i, i + 1)}
                onDuplicate={() => duplicate(i)}
                onRemove={() => remove(i)}
              >
                <BlockBody
                  block={b}
                  onChange={(next) => replaceAt(i, next)}
                />
              </SortableBlockRow>
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
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

interface BodyProps {
  block: Block;
  onChange: (next: Block) => void;
}

function BlockBody({ block, onChange }: BodyProps) {
  switch (block.kind) {
    case "heading":
      return (
        <HeadingBlockEditor
          value={block as Block}
          onChange={(next) => onChange(next as Block)}
        />
      );
    case "paragraph":
      return (
        <ParagraphBlockEditor
          value={block as Block}
          onChange={(next) => onChange(next as Block)}
        />
      );
    case "quote":
      return (
        <QuoteBlockEditor
          value={block as Block}
          onChange={(next) => onChange(next as Block)}
        />
      );
    case "list":
      return (
        <ListBlockEditor
          value={block as Block}
          onChange={(next) => onChange(next as Block)}
        />
      );
    case "divider":
      return (
        <DividerBlockEditor
          value={block as Block}
          onChange={(next) => onChange(next as Block)}
        />
      );
    case "media":
      return (
        <MediaBlockEditor
          value={block as Block}
          onChange={(next) => onChange(next as Block)}
        />
      );
    case "links":
      return (
        <LinksBlockEditor
          value={block as Block}
          onChange={(next) => onChange(next as Block)}
        />
      );
    case "icon":
      return (
        <IconBlockEditor
          value={block as Block}
          onChange={(next) => onChange(next as Block)}
        />
      );
    default:
      return null;
  }
}
