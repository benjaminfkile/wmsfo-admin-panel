import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
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
import type { RJSFSchema } from "@rjsf/utils";
import SchemaForm from "./SchemaForm";
import type { KindInfo, SectionItemAdmin } from "../../api/types";

interface Props {
  items: SectionItemAdmin[];
  kind: KindInfo;
  disabled?: boolean;
  onCreate: (data: object) => void;
  onPatchItem: (id: number, data: object) => void;
  onRemoveItem: (id: number) => void;
  onReorder?: (ids: number[]) => void;
}

interface RowProps {
  id: number;
  disabled?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  children: ReactNode;
}

function SortableRow({
  id,
  disabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
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
  return (
    <Box
      ref={setNodeRef}
      style={style}
      data-testid={`item-row-${id}`}
      sx={{ border: "1px solid", borderColor: "divider", p: 1 }}
    >
      <Stack direction="row" alignItems="center">
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
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          Item #{id}
        </Typography>
        <IconButton
          size="small"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove item"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
      {children}
    </Box>
  );
}

// A section's items (admin.md 6.14). Each item is a small SchemaForm
// over the kind's `itemSchema`. Add uses the kind's `itemDefaults`.
// Rows reorder via drag (dnd-kit) or the up/down keyboard buttons; the
// caller receives the resulting list of ids to persist through
// `PUT /admin/sections/{id}/items/order`.
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
                  disabled={disabled}
                  canMoveUp={index > 0}
                  canMoveDown={index < items.length - 1}
                  onMoveUp={() => reorderTo(index, index - 1)}
                  onMoveDown={() => reorderTo(index, index + 1)}
                  onRemove={() => onRemoveItem(id)}
                >
                  <SchemaForm
                    schema={itemSchema}
                    formData={data}
                    disabled={disabled}
                    onChange={(next: object) => {
                      setDrafts((prev) => ({ ...prev, [id]: next }));
                      onPatchItem(id, next);
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
