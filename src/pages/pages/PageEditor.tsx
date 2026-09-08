import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pages as pagesApi } from "../../api/resources/pages";
import { sections as sectionsApi } from "../../api/resources/sections";
import { content as contentApi } from "../../api/resources/content";
import { keys } from "../../queries/keys";
import ErrorAlert from "../../components/ErrorAlert";
import ConfirmDialog from "../../components/ConfirmDialog";
import SectionCard, {
  type SaveState,
} from "../../components/content/SectionCard";
import SectionPalette from "../../components/content/SectionPalette";
import PageSettingsDialog, {
  type PageSettingsSubmit,
} from "./PageSettingsDialog";
import { useNotify } from "../../hooks/useNotify";
import type {
  KindInfo,
  Presentation,
  SectionAdmin,
} from "../../api/types";

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const pageId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const notify = useNotify();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<SectionAdmin | null>(null);
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({});

  const pageQ = useQuery({
    queryKey: keys.page(pageId),
    queryFn: () => pagesApi.get(pageId),
    enabled: Number.isFinite(pageId),
  });
  const kindsQ = useQuery({
    queryKey: keys.kinds,
    queryFn: () => contentApi.kinds(),
  });

  const page = pageQ.data;
  const kinds: KindInfo[] = useMemo(
    () => kindsQ.data?.items ?? [],
    [kindsQ.data]
  );
  const kindByName = useMemo(() => {
    const m: Record<string, KindInfo> = {};
    for (const k of kinds) if (k.kind) m[k.kind] = k;
    return m;
  }, [kinds]);
  const sectionsData: SectionAdmin[] = page?.sections ?? [];

  const setSaveState = (id: number, s: SaveState) =>
    setSaveStates((prev) => ({ ...prev, [id]: s }));

  const patchSectionMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: {
        data?: object;
        presentation?: Presentation;
        isHidden?: boolean;
      };
    }) => sectionsApi.patch(id, body),
    onMutate: ({ id }) => setSaveState(id, "saving"),
    onSuccess: (_res, vars) => {
      setSaveState(vars.id, "saved");
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
    onError: (_e, vars) => setSaveState(vars.id, "error"),
  });

  const createSectionMut = useMutation({
    mutationFn: (kind: KindInfo) =>
      sectionsApi.create(pageId, {
        kind: kind.kind ?? "",
        data: (kind.defaults ?? {}) as object,
      }),
    onSuccess: () => {
      notify("Section added");
      setPaletteOpen(false);
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const duplicateMut = useMutation({
    mutationFn: (sectionId: number) => sectionsApi.duplicate(sectionId),
    onSuccess: () => {
      notify("Section duplicated");
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const deleteSectionMut = useMutation({
    mutationFn: (sectionId: number) => sectionsApi.remove(sectionId),
    onSuccess: () => {
      notify("Section deleted");
      setDeleteFor(null);
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const reorderMut = useMutation({
    mutationFn: (ids: number[]) => sectionsApi.order(pageId, ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const settingsMut = useMutation({
    mutationFn: (body: PageSettingsSubmit) =>
      pagesApi.patch(pageId, {
        slug: body.slug,
        title: body.title,
        navLabel: body.navLabel,
        isHidden: body.isHidden,
      }),
    onSuccess: () => {
      notify("Page saved");
      setSettingsOpen(false);
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
      void qc.invalidateQueries({ queryKey: keys.pages });
    },
  });

  const createItemMut = useMutation({
    mutationFn: ({
      sectionId,
      data,
    }: {
      sectionId: number;
      data: object;
    }) => sectionsApi.createItem(sectionId, { data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });
  const patchItemMut = useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: number;
      data: object;
    }) => sectionsApi.patchItem(itemId, { data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });
  const removeItemMut = useMutation({
    mutationFn: (itemId: number) => sectionsApi.removeItem(itemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const move = (index: number, delta: -1 | 1) => {
    const next = sectionsData.slice();
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    const cur = next[index];
    const swp = next[to];
    if (!cur || !swp) return;
    next[index] = swp;
    next[to] = cur;
    reorderMut.mutate(next.map((s) => Number(s.id ?? 0)));
  };

  if (!Number.isFinite(pageId)) {
    return <ErrorAlert error={new Error("Invalid page id")} />;
  }
  if (pageQ.error) return <ErrorAlert error={pageQ.error} />;
  if (kindsQ.error) return <ErrorAlert error={kindsQ.error} />;
  if (!page) return <Typography>Loading…</Typography>;

  const problemCount = Number(page.problemCount ?? 0);
  const pageRole = page.role ?? "none";

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4">{page.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            /{page.slug}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {problemCount > 0 ? (
            <Chip label={`${problemCount} problems`} color="error" />
          ) : (
            <Chip label="No problems" color="success" />
          )}
          <Button onClick={() => setSettingsOpen(true)}>Page settings</Button>
          <Button onClick={() => navigate("/publish")} variant="outlined">
            Publish
          </Button>
        </Stack>
      </Stack>

      <Box data-testid="section-stack">
        {sectionsData.length === 0 ? (
          <Typography color="text.secondary">No sections yet.</Typography>
        ) : (
          sectionsData.map((s, i) => {
            const id = Number(s.id ?? 0);
            const kind = kindByName[s.kind ?? ""];
            if (!kind) {
              return (
                <ErrorAlert
                  key={id}
                  error={new Error(`Unknown kind: ${s.kind}`)}
                />
              );
            }
            return (
              <Box key={id}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <IconButton
                    size="small"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reorderMut.isPending}
                    aria-label="Move up"
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => move(i, 1)}
                    disabled={
                      i === sectionsData.length - 1 || reorderMut.isPending
                    }
                    aria-label="Move down"
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <SectionCard
                  section={s}
                  kind={kind}
                  saveState={saveStates[id] ?? "idle"}
                  onPatch={(body) => patchSectionMut.mutate({ id, body })}
                  onDuplicate={() => duplicateMut.mutate(id)}
                  onDelete={() => setDeleteFor(s)}
                  onCreateItem={(data) =>
                    createItemMut.mutate({ sectionId: id, data })
                  }
                  onPatchItem={(itemId, data) =>
                    patchItemMut.mutate({ itemId, data })
                  }
                  onRemoveItem={(itemId) => removeItemMut.mutate(itemId)}
                />
              </Box>
            );
          })
        )}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={() => setPaletteOpen(true)}>
          Add section
        </Button>
      </Box>

      <SectionPalette
        open={paletteOpen}
        onCancel={() => setPaletteOpen(false)}
        onChoose={(k) => createSectionMut.mutate(k)}
        kinds={kinds}
        pageRole={pageRole}
      />

      {settingsOpen ? (
        <PageSettingsDialog
          open={settingsOpen}
          page={page}
          onCancel={() => setSettingsOpen(false)}
          onSave={(body) => settingsMut.mutate(body)}
          pending={settingsMut.isPending}
          error={settingsMut.error}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteFor)}
        title="Delete section"
        body={
          deleteFor
            ? `Delete the ${deleteFor.kind} section? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteFor(null)}
        onConfirm={() =>
          deleteFor ? deleteSectionMut.mutate(Number(deleteFor.id ?? 0)) : undefined
        }
        disabled={deleteSectionMut.isPending}
      />
    </>
  );
}
