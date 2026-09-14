import { useState } from "react";
import { IconButton, TableCell, Tooltip } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import type { AuditStamp } from "../../api/types";
import { stampText } from "./auditFormat";
import AuditHistoryDialog from "./AuditHistoryDialog";

interface Props {
  entity: string;
  entityId: string | number;
  name: string;
  audit: AuditStamp | null | undefined;
  align?: "left" | "right";
  // When rendering outside a table row (a compact card footer) pass
  // `asCell={false}` so the button is not wrapped in a `TableCell`.
  asCell?: boolean;
}

export default function AuditCell({
  entity,
  entityId,
  name,
  audit,
  align,
  asCell = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const tooltip = stampText(audit);
  const button = (
    <>
      <Tooltip title={tooltip}>
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          aria-label={`Audit ${name}`}
        >
          <HistoryIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {open ? (
        <AuditHistoryDialog
          open
          entity={entity}
          entityId={String(entityId)}
          title={name}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
  if (!asCell) return button;
  return (
    <TableCell align={align} data-testid={`audit-cell-${entity}-${entityId}`}>
      {button}
    </TableCell>
  );
}
