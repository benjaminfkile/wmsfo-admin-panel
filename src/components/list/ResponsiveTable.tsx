import type { ReactNode } from "react";
import {
  Box,
  Card,
  CardContent,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { SxProps } from "@mui/material/styles";
import type { AuditStamp } from "../../api/types";
import { useCompact } from "../../hooks/useCompact";
import AuditCell from "../audit/AuditCell";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  role?: "title" | "subtitle" | "chip" | "line" | "desktop-only";
  label?: string;
}

export interface RowAudit {
  entity: string;
  entityId: string | number;
  name: string;
  audit: AuditStamp | null | undefined;
}

export interface ResponsiveTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowTestId?: (row: T) => string;
  rowSx?: (row: T) => SxProps;
  actions?: (row: T) => ReactNode;
  audit?: (row: T) => RowAudit;
  emptyText: string;
  leading?: (row: T) => ReactNode;
  size?: "small" | "medium";
}

export default function ResponsiveTable<T>(props: ResponsiveTableProps<T>) {
  const compact = useCompact();
  return compact ? (
    <CompactCards {...props} />
  ) : (
    <DesktopTable {...props} />
  );
}

function DesktopTable<T>({
  rows,
  columns,
  rowKey,
  rowTestId,
  rowSx,
  actions,
  audit,
  emptyText,
  leading,
  size = "small",
}: ResponsiveTableProps<T>) {
  const hasLeading = leading !== undefined;
  const hasActions = actions !== undefined;
  const hasAudit = audit !== undefined;
  const colSpan =
    columns.length +
    (hasLeading ? 1 : 0) +
    (hasActions ? 1 : 0) +
    (hasAudit ? 1 : 0);
  return (
    <TableContainer component={Paper}>
      <Table size={size}>
        <TableHead>
          <TableRow>
            {hasLeading ? <TableCell /> : null}
            {columns.map((c) => (
              <TableCell key={c.key} align={c.align}>
                {c.header}
              </TableCell>
            ))}
            {hasActions ? <TableCell align="right">Actions</TableCell> : null}
            {hasAudit ? <TableCell align="right">Audit</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan}>
                <Typography variant="body2" color="text.secondary">
                  {emptyText}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const info = hasAudit ? audit(row) : null;
              return (
                <TableRow
                  key={rowKey(row)}
                  hover
                  {...(rowTestId ? { "data-testid": rowTestId(row) } : {})}
                  {...(rowSx ? { sx: rowSx(row) } : {})}
                >
                  {hasLeading ? <TableCell>{leading(row)}</TableCell> : null}
                  {columns.map((c) => (
                    <TableCell key={c.key} align={c.align}>
                      {c.render(row)}
                    </TableCell>
                  ))}
                  {hasActions ? (
                    <TableCell align="right">{actions(row)}</TableCell>
                  ) : null}
                  {hasAudit && info ? (
                    <AuditCell
                      entity={info.entity}
                      entityId={info.entityId}
                      name={info.name}
                      audit={info.audit}
                      align="right"
                    />
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function labelFor<T>(column: Column<T>): string {
  if (column.label !== undefined) return column.label;
  if (typeof column.header === "string") return column.header;
  if (typeof column.header === "number") return String(column.header);
  return column.key;
}

function CompactCards<T>({
  rows,
  columns,
  rowKey,
  rowTestId,
  rowSx,
  actions,
  audit,
  emptyText,
  leading,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  const titleCol = columns.find((c) => c.role === "title");
  const subtitleCol = columns.find((c) => c.role === "subtitle");
  const chipCols = columns.filter((c) => c.role === "chip");
  const lineCols = columns.filter((c) => c.role === "line");
  return (
    <Stack spacing={1}>
      {rows.map((row) => {
        const info = audit ? audit(row) : null;
        return (
          <Card
            key={rowKey(row)}
            variant="outlined"
            {...(rowTestId ? { "data-testid": rowTestId(row) } : {})}
            {...(rowSx ? { sx: rowSx(row) } : {})}
          >
            <CardContent>
              <Stack spacing={1}>
                {titleCol ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    {leading ? <Box>{leading(row)}</Box> : null}
                    <Typography variant="subtitle1" sx={{ minWidth: 0 }}>
                      {titleCol.render(row)}
                    </Typography>
                  </Stack>
                ) : null}
                {subtitleCol ? (
                  <Typography variant="body2" color="text.secondary">
                    {subtitleCol.render(row)}
                  </Typography>
                ) : null}
                {chipCols.length > 0 ? (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    {chipCols.map((c) => (
                      <Box key={c.key}>{c.render(row)}</Box>
                    ))}
                  </Stack>
                ) : null}
                {lineCols.map((c) => (
                  <Typography key={c.key} variant="body2">
                    <Box component="span" sx={{ color: "text.secondary" }}>
                      {labelFor(c)}:{" "}
                    </Box>
                    {c.render(row)}
                  </Typography>
                ))}
                {actions || info ? (
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                  >
                    <Box>{actions ? actions(row) : null}</Box>
                    <Box>
                      {info ? (
                        <AuditCell
                          asCell={false}
                          entity={info.entity}
                          entityId={info.entityId}
                          name={info.name}
                          audit={info.audit}
                        />
                      ) : null}
                    </Box>
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
