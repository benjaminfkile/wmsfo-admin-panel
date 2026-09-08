import { Box } from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import PresentationPanel from "../PresentationPanel";
import type { Presentation } from "../../../api/types";

// Field-side wrapper: routes the schema-level `Presentation` primitive
// through the panel component. Kept separate so the component can also
// be embedded directly on the Presentation tab of a section card.
export default function PresentationPanelField(props: FieldProps) {
  const value = props.formData as Presentation | undefined;
  return (
    <Box sx={{ my: 1 }} data-testid="presentation-field">
      <PresentationPanel
        value={value}
        onChange={(next) => props.onChange(next as unknown, props.fieldPathId.path)}
      />
    </Box>
  );
}
