import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settings as settingsApi } from "../../api/resources/settings";
import { keys } from "../../queries/keys";
import CommentBox from "../../components/CommentBox";
import ErrorAlert from "../../components/ErrorAlert";
import PageHeader from "../../components/layout/PageHeader";
import ResponsiveTable, {
  type Column,
} from "../../components/list/ResponsiveTable";
import { useNotify } from "../../hooks/useNotify";
import { formatMt } from "../../lib/time";
import {
  SETTING_SPECS,
  specFor,
  validateSettingValue,
  type SettingSpec,
} from "../../validation/settings";
import type { Setting } from "../../api/types";

interface RowState {
  input: string;
  error: string | null;
  saving: boolean;
}

type SetRowState = (key: string, patch: Partial<RowState>) => void;

export default function Settings() {
  const qc = useQueryClient();
  const notify = useNotify();

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

  const initialFor = (s: Setting): string =>
    typeof s.value === "number"
      ? String(s.value)
      : typeof s.value === "string"
        ? s.value
        : "";

  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  useEffect(() => {
    setRowState((prev) => {
      const next: Record<string, RowState> = { ...prev };
      let changed = false;
      for (const s of settings) {
        const key = s.key ?? "";
        if (!next[key]) {
          next[key] = { input: initialFor(s), error: null, saving: false };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQ.data]);

  const setRow: SetRowState = (key, patch) =>
    setRowState((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { input: "", error: null, saving: false }), ...patch },
    }));

  const saveMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: number }) =>
      settingsApi.put(key, value),
    onSuccess: (row) => {
      notify(`${row.key} saved`);
      qc.setQueryData(keys.settings, (prev: { items: Setting[] } | undefined) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((s) => (s.key === row.key ? row : s)),
            }
          : prev
      );
      void qc.invalidateQueries({ queryKey: keys.settings });
      setRow(row.key ?? "", {
        input: initialFor(row),
        error: null,
        saving: false,
      });
    },
    onError: (e, vars) => {
      notify(e instanceof Error ? e.message : "Save failed", "error");
      setRow(vars.key, { saving: false });
    },
  });

  const submit = (s: Setting) => {
    const key = s.key ?? "";
    const spec = specFor(key);
    const state = rowState[key] ?? { input: "", error: null, saving: false };
    if (!spec) return;
    const check = validateSettingValue(spec, state.input);
    if (!check.ok) {
      setRow(key, { error: check.message });
      return;
    }
    setRow(key, { error: null, saving: true });
    saveMut.mutate({ key, value: check.value });
  };

  const renderValue = (s: Setting) => {
    const key = s.key ?? "";
    const spec = specFor(key);
    const state = rowState[key] ?? {
      input: initialFor(s),
      error: null,
      saving: false,
    };
    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        justifyContent="flex-end"
        useFlexGap
        flexWrap="wrap"
      >
        <TextField
          type="number"
          size="small"
          value={state.input}
          onChange={(e) => setRow(key, { input: e.target.value })}
          error={Boolean(state.error)}
          helperText={state.error ?? (spec ? rangeHint(spec) : "")}
          inputProps={
            spec
              ? {
                  min: spec.min,
                  max: spec.max,
                  step: spec.allowDecimal ? "any" : 1,
                }
              : undefined
          }
          sx={{ maxWidth: "100%", width: { xs: "100%", sm: 200 } }}
          aria-label={key || "value"}
        />
        <Box sx={{ pt: 0.5 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => submit(s)}
            disabled={state.saving}
          >
            Save
          </Button>
        </Box>
      </Stack>
    );
  };

  const columns: Column<Setting>[] = [
    {
      key: "key",
      header: "Key",
      role: "title",
      render: (s) => (
        <Box component="code" sx={{ overflowWrap: "anywhere" }}>
          {s.key}
        </Box>
      ),
    },
    {
      key: "description",
      header: "Description",
      role: "subtitle",
      render: (s) => {
        const spec = specFor(s.key ?? "");
        return spec ? (
          <Typography variant="body2">
            {spec.description}
            {spec.unit ? ` (${spec.unit})` : ""}
          </Typography>
        ) : (
          <>none</>
        );
      },
    },
    {
      key: "updatedBy",
      header: "Updated by",
      role: "line",
      render: (s) => s.updatedBy ?? "default",
    },
    {
      key: "updatedAt",
      header: "Updated at",
      role: "line",
      render: (s) =>
        s.updatedAt ? formatMt(s.updatedAt) : "default",
    },
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <CommentBox>
        Every save rebuilds the snapshot and rewrites the live object, so a new
        poll interval reaches the site within its next poll.
      </CommentBox>
      {settingsQ.error ? (
        <ErrorAlert error={settingsQ.error} />
      ) : (
        <ResponsiveTable<Setting>
          rows={sorted}
          columns={columns}
          rowKey={(s) => s.key ?? ""}
          rowTestId={(s) => `setting-row-${s.key}`}
          emptyText="No settings."
          actions={renderValue}
          audit={(s) => ({
            entity: "setting",
            entityId: s.key ?? "",
            name: s.key ?? "setting",
            audit: s.audit,
          })}
        />
      )}
    </>
  );
}

function rangeHint(spec: SettingSpec | null): string {
  if (!spec) return "";
  return `${spec.min} to ${spec.max}${spec.unit ? ` ${spec.unit}` : ""}`;
}
