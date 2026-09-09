import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settings as settingsApi } from "../../api/resources/settings";
import { keys } from "../../queries/keys";
import CommentBox from "../../components/CommentBox";
import ErrorAlert from "../../components/ErrorAlert";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import {
  SETTING_SPECS,
  specFor,
  validateSettingValue,
  type SettingSpec,
} from "../../validation/settings";
import type { Setting } from "../../api/types";

export default function Settings() {
  const settingsQ = useQuery({
    queryKey: keys.settings,
    queryFn: () => settingsApi.list(),
  });

  const settings = settingsQ.data?.items ?? [];
  // Preserve the documented order (6.9); unknown keys go last.
  const order = new Map<string, number>(
    SETTING_SPECS.map((s, i) => [s.key as string, i])
  );
  const sorted = [...settings].sort(
    (a, b) =>
      (order.get(a.key ?? "") ?? SETTING_SPECS.length) -
      (order.get(b.key ?? "") ?? SETTING_SPECS.length)
  );

  return (
    <>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Settings
      </Typography>
      <CommentBox>
        Every save rebuilds the snapshot and rewrites the live object, so a new
        poll interval reaches the site within its next poll.
      </CommentBox>
      {settingsQ.error ? (
        <ErrorAlert error={settingsQ.error} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell>Updated by</TableCell>
                <TableCell>Updated at</TableCell>
                <TableCell align="right">Save</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((s) => (
                <SettingRow key={s.key} setting={s} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}

function SettingRow({ setting }: { setting: Setting }) {
  const qc = useQueryClient();
  const notify = useNotify();
  const spec = specFor(setting.key ?? "");
  const initial =
    typeof setting.value === "number"
      ? String(setting.value)
      : typeof setting.value === "string"
      ? setting.value
      : "";
  const [input, setInput] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInput(initial);
    setError(null);
  }, [initial]);

  const saveMut = useMutation({
    mutationFn: (value: number) =>
      settingsApi.put(setting.key ?? "", value),
    onSuccess: (row) => {
      notify(`${setting.key} saved`);
      qc.setQueryData(keys.settings, (prev: { items: Setting[] } | undefined) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((s) =>
                s.key === row.key ? row : s
              ),
            }
          : prev
      );
      void qc.invalidateQueries({ queryKey: keys.settings });
    },
    onError: (e) =>
      notify(e instanceof Error ? e.message : "Save failed", "error"),
  });

  const submit = () => {
    if (!spec) return;
    const check = validateSettingValue(spec, input);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    saveMut.mutate(check.value);
  };

  const updatedBy = setting.updatedBy ?? "default";
  const updatedAt = setting.updatedAt ? formatMt(setting.updatedAt) : "default";

  return (
    <TableRow data-testid={`setting-row-${setting.key}`}>
      <TableCell>
        <code>{setting.key}</code>
      </TableCell>
      <TableCell>
        {spec ? (
          <Typography variant="body2">
            {spec.description}
            {spec.unit ? ` (${spec.unit})` : ""}
          </Typography>
        ) : (
          "none"
        )}
      </TableCell>
      <TableCell align="right">
        <Stack spacing={0.5} alignItems="flex-end">
          <TextField
            type="number"
            size="small"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            error={Boolean(error)}
            helperText={error ?? (spec ? rangeHint(spec) : "")}
            inputProps={
              spec ? { min: spec.min, max: spec.max, step: 1 } : undefined
            }
            sx={{ maxWidth: 200 }}
            aria-label={setting.key ?? "value"}
          />
        </Stack>
      </TableCell>
      <TableCell>{updatedBy}</TableCell>
      <TableCell>{updatedAt}</TableCell>
      <TableCell align="right">
        <Box>
          <Button
            variant="contained"
            size="small"
            onClick={submit}
            disabled={saveMut.isPending}
          >
            Save
          </Button>
        </Box>
      </TableCell>
    </TableRow>
  );
}

function rangeHint(spec: SettingSpec | null): string {
  if (!spec) return "";
  return `${spec.min} to ${spec.max}${spec.unit ? ` ${spec.unit}` : ""}`;
}
