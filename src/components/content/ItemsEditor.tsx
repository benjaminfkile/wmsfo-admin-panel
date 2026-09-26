import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Switch,
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
import type { RJSFSchema } from "@rjsf/utils";
import SchemaForm from "./SchemaForm";
import { itemSummary } from "./sectionSummary";
import type { KindInfo, SectionItemAdmin } from "../../api/types";

export type ItemPatchBody = Partial<{ data: object; isHidden: boolean }>;

interface Props {
  items: SectionItemAdmin[];
  kind: KindInfo;
  disabled?: boolean;
  onCreate: (data: object) => void;
  onPatchItem: (id: number, body: ItemPatchBody) => void;
  onRemoveItem: (id: number) => void;
  onReorder?: (ids: number[]) => void;
}

interface RowProps {
  id: number;
  index: number;
  total: number;
  summary: string;
  hidden: boolean;
  disabled?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onToggleHidden: (next: boolean) => void;
  children: ReactNode;
}

function SortableRow({
  id,
  index,
  total,
  summary,
  hidden,
  disabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
  onToggleHidden,
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
    opacity: isDragging ? 0.5 : hidden ? 0.5 : 1,
  };
  return (
    <Card
      ref={setNodeRef}
      style={style}
      variant="outlined"
      data-testid={`item-row-${id}`}
      sx={{
        bgcolor: "action.hover",
        borderColor: "divider",
        ml: 2,
      }}
    >
      <Box
        sx={{
          bgcolor: "action.selected",
          px: 1,
          py: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap">
          <IconButton
            size="small"
            disabled={disabled}
            aria-label={`Drag item ${id}`}
            {...attributes}
            {...listeners}
            sx={{ cursor: "grab" }}
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={onMoveUp}
            disabled={disabled || !canMoveUp}
            aria-label={`Move item ${id} up`}
          >
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={onMoveDown}
            disabled={disabled || !canMoveDown}
            aria-label={`Move item ${id} down`}
          >
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
          <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600 }}
                data-testid={`item-title-${id}`}
              >
                Item {index + 1} of {total}
              </Typography>
              {hidden ? (
                <Chip
                  size="small"
                  label="Hidden"
                  data-testid={`item-hidden-chip-${id}`}
                />
              ) : null}
            </Stack>
            {summary ? (
              <Typography
                variant="caption"
                color="text.secondary"
                data-testid={`item-summary-${id}`}
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
          <Stack direction="row" alignItems="center">
            <Typography variant="caption">Hidden</Typography>
            <Switch
              size="small"
              checked={hidden}
              onChange={(e) => onToggleHidden(e.target.checked)}
              disabled={disabled}
              inputProps={{
                "aria-label": `Hide item ${id}`,
              }}
              data-testid={`item-hidden-switch-${id}`}
            />
          </Stack>
          <IconButton
            size="small"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove item"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      <CardContent sx={{ pt: 1 }}>{children}</CardContent>
    </Card>
  );
}

// A section's items (admin.md 6.14). Each item is a nested card inside
// the parent section card: a tinted header with the drag handle, up
// and down arrows, "Item n of m", a short summary, a Hidden switch
// that PATCHes only `isHidden`, and a remove icon. The item's
// SchemaForm sits under the header. Rows reorder via drag (dnd-kit)
// or the up/down buttons; the caller receives the new list of ids to
// persist through `PUT /admin/sections/{id}/items/order`. Add uses
// the kind's `itemDefaults`. A hidden item's card is dimmed and
// carries a "Hidden" label.
export default function ItemsEditor({
  items,
  kind,
  disabled,
  onCreate,
  onPatchItem,
  onRemoveItem,
  onReorder,
}: Props) {
  const [drafts, setDrafts] = useState<Record<number, object>>({});
  const itemSchema = (kind.itemSchema ?? null) as RJSFSchema | null;
  const defaults = (kind.itemDefaults ?? {}) as object;
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!itemSchema) return null;

  const ids = items.map((it) => Number(it.id ?? 0));

  const reorderTo = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= ids.length ||
      toIndex >= ids.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    onReorder?.(arrayMove(ids, fromIndex, toIndex));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    reorderTo(from, to);
  };

  return (
    <Box sx={{ my: 1 }} data-testid="items-editor">
      <Typography variant="subtitle2" gutterBottom>
        Items
      </Typography>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Stack spacing={2}>
            {items.map((it, index) => {
              const id = Number(it.id ?? 0);
              const data =
                drafts[id] ??
                (typeof it.data === "object" && it.data !== null
                  ? (it.data as object)
                  : {});
              return (
                <SortableRow
                  key={id}
                  id={id}
                  index={index}
                  total={items.length}
                  summary={itemSummary(it.data)}
                  hidden={Boolean(it.isHidden)}
                  disabled={disabled}
                  canMoveUp={index > 0}
                  canMoveDown={index < items.length - 1}
                  onMoveUp={() => reorderTo(index, index - 1)}
                  onMoveDown={() => reorderTo(index, index + 1)}
                  onRemove={() => onRemoveItem(id)}
                  onToggleHidden={(next) =>
                    onPatchItem(id, { isHidden: next })
                  }
                >
                  <SchemaForm
                    schema={itemSchema}
                    kind={kind.kind}
                    isItem
                    formData={data}
                    disabled={disabled}
                    onChange={(next: object) => {
                      setDrafts((prev) => ({ ...prev, [id]: next }));
                      onPatchItem(id, { data: next });
                    }}
                  />
                </SortableRow>
              );
            })}
          </Stack>
        </SortableContext>
      </DndContext>
      <Box sx={{ mt: 1 }}>
        <Button
          size="small"
          disabled={disabled}
          onClick={() => onCreate({ ...defaults })}
        >
          Add item
        </Button>
      </Box>
    </Box>
  );
}
