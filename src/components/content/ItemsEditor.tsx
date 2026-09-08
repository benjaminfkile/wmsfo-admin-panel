import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
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

// A section's items (admin.md 6.14). Each item is a small SchemaForm
// over the kind's `itemSchema`. Add uses the kind's `itemDefaults`.
export default function ItemsEditor({
  items,
  kind,
  disabled,
  onCreate,
  onPatchItem,
  onRemoveItem,
}: Props) {
  const [drafts, setDrafts] = useState<Record<number, object>>({});
  const itemSchema = (kind.itemSchema ?? null) as RJSFSchema | null;
  const defaults = (kind.itemDefaults ?? {}) as object;

  if (!itemSchema) return null;

  return (
    <Box sx={{ my: 1 }} data-testid="items-editor">
      <Typography variant="subtitle2" gutterBottom>
        Items
      </Typography>
      <Stack spacing={2}>
        {items.map((it) => {
          const id = Number(it.id ?? 0);
          const data =
            drafts[id] ?? (typeof it.data === "object" && it.data !== null ? (it.data as object) : {});
          return (
            <Box
              key={id}
              sx={{ border: "1px solid", borderColor: "divider", p: 1 }}
            >
              <Stack direction="row" alignItems="center">
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  Item #{id}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => onRemoveItem(id)}
                  disabled={disabled}
                  aria-label="Remove item"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
              <SchemaForm
                schema={itemSchema}
                formData={data}
                disabled={disabled}
                onChange={(next: object) => {
                  setDrafts((prev) => ({ ...prev, [id]: next }));
                  onPatchItem(id, next);
                }}
              />
            </Box>
          );
        })}
      </Stack>
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
