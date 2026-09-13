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
}

export default function AuditCell({
  entity,
  entityId,
  name,
  audit,
  align,
}: Props) {
  const [open, setOpen] = useState(false);
  const tooltip = stampText(audit);
  return (
    <TableCell align={align} data-testid={`audit-cell-${entity}-${entityId}`}>
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
    </TableCell>
  );
}
