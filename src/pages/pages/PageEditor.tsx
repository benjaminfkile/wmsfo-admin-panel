import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { ErrorSchema } from "@rjsf/utils";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pages as pagesApi } from "../../api/resources/pages";
import { sections as sectionsApi } from "../../api/resources/sections";
import { content as contentApi } from "../../api/resources/content";
import { keys } from "../../queries/keys";
import { ApiError } from "../../api/errors";
import { fieldsToErrorSchema } from "../../lib/fieldErrors";
import ErrorAlert from "../../components/ErrorAlert";
import ConfirmDialog from "../../components/ConfirmDialog";
import PageHeader from "../../components/layout/PageHeader";
import SectionCard, {
  type SaveState,
} from "../../components/content/SectionCard";
import SectionPalette from "../../components/content/SectionPalette";
import MoveSectionDialog from "../../components/content/MoveSectionDialog";
import PreviewPane from "../../components/content/PreviewPane";
import PreviewFrame from "../../components/content/PreviewFrame";
import PageSettingsDialog, {
  type PageSettingsSubmit,
} from "./PageSettingsDialog";
import { useNotify } from "../../hooks/useNotify";
import type {
  KindInfo,
  PageAdmin,
  Presentation,
  SectionAdmin,
} from "../../api/types";

// localStorage key holding "1" while the preview column is open.
const PREVIEW_OPEN_KEY = "pageEditorPreviewOpen";
// The narrowest viewport that shows the preview as a column beside the
// editor; below it the preview opens as the dialog.
export const PREVIEW_SIDE_QUERY = "(min-width:1280px)";
// The editor column's width while the preview column is open.
const EDITOR_MIN_WIDTH = 560;

function readPreviewOpen(): boolean {
  try {
    return localStorage.getItem(PREVIEW_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writePreviewOpen(open: boolean) {
  try {
    if (open) localStorage.setItem(PREVIEW_OPEN_KEY, "1");
    else localStorage.removeItem(PREVIEW_OPEN_KEY);
  } catch {
    // Storage unavailable: the state lasts for this visit only.
  }
}

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const pageId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const notify = useNotify();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<SectionAdmin | null>(null);
  const [moveFor, setMoveFor] = useState<SectionAdmin | null>(null);
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({});
  const [fieldErrors, setFieldErrors] = useState<
    Record<number, ErrorSchema>
  >({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const wide = useMediaQuery(PREVIEW_SIDE_QUERY);
  // The column's open state is remembered; the dialog opens per visit.
  const [previewOpen, setPreviewOpen] = useState<boolean>(readPreviewOpen);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  // Counts finished saves; the preview reloads (debounced) on each change.
  const [saveCount, setSaveCount] = useState(0);
  const markSaved = () => setSaveCount((n) => n + 1);

  const setColumnOpen = (open: boolean) => {
    setPreviewOpen(open);
    writePreviewOpen(open);
  };
  const togglePreview = () => {
    if (wide) setColumnOpen(!previewOpen);
    else setPreviewDialogOpen(true);
  };
  const showColumn = wide && previewOpen;

  const pageQ = useQuery({
    queryKey: keys.page(pageId),
    queryFn: () => pagesApi.get(pageId),
    enabled: Number.isFinite(pageId),
  });
  const pagesQ = useQuery({
    queryKey: keys.pages,
    queryFn: () => pagesApi.list(),
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
      markSaved();
      setSaveState(vars.id, "saved");
      setFieldErrors((prev) => {
        if (!prev[vars.id]) return prev;
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
    onError: (err, vars) => {
      setSaveState(vars.id, "error");
      if (err instanceof ApiError && err.code === "validation_failed") {
        const errorSchema = fieldsToErrorSchema(err.fields);
        setFieldErrors((prev) => ({ ...prev, [vars.id]: errorSchema }));
      }
    },
  });

  const createSectionMut = useMutation({
    mutationFn: (kind: KindInfo) =>
      sectionsApi.create(pageId, {
        kind: kind.kind ?? "",
        data: (kind.defaults ?? {}) as object,
      }),
    onSuccess: (created) => {
      markSaved();
      notify("Section added");
      setPaletteOpen(false);
      const newId = Number(created.id ?? 0);
      if (newId) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(newId);
          return next;
        });
      }
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const duplicateMut = useMutation({
    mutationFn: (sectionId: number) => sectionsApi.duplicate(sectionId),
    onSuccess: () => {
      markSaved();
      notify("Section duplicated");
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const deleteSectionMut = useMutation({
    mutationFn: (sectionId: number) => sectionsApi.remove(sectionId),
    onSuccess: () => {
      markSaved();
      notify("Section deleted");
      setDeleteFor(null);
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const reorderMut = useMutation({
    mutationFn: (ids: number[]) => sectionsApi.order(pageId, ids),
    onSuccess: () => {
      markSaved();
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });

  const settingsMut = useMutation({
    mutationFn: (body: PageSettingsSubmit) =>
      pagesApi.patch(pageId, {
        slug: body.slug,
        title: body.title,
        navLabel: body.navLabel,
        icon: body.icon,
        isHidden: body.isHidden,
      }),
    onSuccess: () => {
      markSaved();
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
      markSaved();
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });
  const patchItemMut = useMutation({
    mutationFn: ({
      itemId,
      body,
    }: {
      itemId: number;
      body: Partial<{ data: object; isHidden: boolean }>;
    }) => sectionsApi.patchItem(itemId, body),
    onSuccess: () => {
      markSaved();
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });
  const removeItemMut = useMutation({
    mutationFn: (itemId: number) => sectionsApi.removeItem(itemId),
    onSuccess: () => {
      markSaved();
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });
  const orderItemsMut = useMutation({
    mutationFn: ({
      sectionId,
      ids,
    }: {
      sectionId: number;
      ids: number[];
    }) => sectionsApi.orderItems(sectionId, ids),
    onSuccess: () => {
      markSaved();
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
    },
  });
  const moveMut = useMutation({
    mutationFn: ({
      sectionId,
      targetPageId,
      position,
    }: {
      sectionId: number;
      targetPageId: number;
      position: number;
    }) =>
      sectionsApi.move(sectionId, {
        pageId: targetPageId,
        position,
      }),
    onSuccess: (_res, vars) => {
      markSaved();
      notify("Section moved");
      setMoveFor(null);
      void qc.invalidateQueries({ queryKey: keys.page(pageId) });
      void qc.invalidateQueries({
        queryKey: keys.page(vars.targetPageId),
      });
      void qc.invalidateQueries({ queryKey: keys.pages });
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

  const toggleExpanded = (sectionId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };
  const expandAll = () => {
    setExpandedIds(
      new Set(sectionsData.map((s) => Number(s.id ?? 0)).filter(Boolean))
    );
  };
  const collapseAll = () => setExpandedIds(new Set());

  if (!Number.isFinite(pageId)) {
    return <ErrorAlert error={new Error("Invalid page id")} />;
  }
  if (pageQ.error) return <ErrorAlert error={pageQ.error} />;
  if (kindsQ.error) return <ErrorAlert error={kindsQ.error} />;
  if (!page) return <Typography>Loading…</Typography>;

  const problemCount = Number(page.problemCount ?? 0);
  const pageRole = page.role ?? "none";

  const editor = (
    <>
      <PageHeader
        title={page.title ?? "Page"}
        subtitle={
          <Typography variant="body2" color="text.secondary">
            /{page.slug}
          </Typography>
        }
        chips={
          problemCount > 0 ? (
            <Chip label={`${problemCount} problems`} color="error" />
          ) : (
            <Chip label="No problems" color="success" />
          )
        }
        actions={
          <>
            <Button
              onClick={togglePreview}
              variant={showColumn ? "contained" : "text"}
              aria-pressed={showColumn}
              data-testid="page-preview-toggle"
            >
              Preview
            </Button>
            <Button onClick={() => setSettingsOpen(true)}>Page settings</Button>
            <Button onClick={() => navigate("/publish")} variant="outlined">
              Publish
            </Button>
          </>
        }
      />

      {sectionsData.length > 0 ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 2 }}
          data-testid="section-stack-actions"
        >
          <Button size="small" onClick={expandAll}>
            Expand all
          </Button>
          <Button size="small" onClick={collapseAll}>
            Collapse all
          </Button>
        </Stack>
      ) : null}

      <Stack spacing={2} data-testid="section-stack">
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
            const canUp = i > 0 && !reorderMut.isPending;
            const canDown =
              i < sectionsData.length - 1 && !reorderMut.isPending;
            const expanded = expandedIds.has(id);
            return (
              <SectionCard
                key={id}
                section={s}
                kind={kind}
                position={i + 1}
                expanded={expanded}
                onToggleExpanded={() => toggleExpanded(id)}
                saveState={saveStates[id] ?? "idle"}
                extraErrors={fieldErrors[id]}
                onPatch={(body) => patchSectionMut.mutate({ id, body })}
                onDuplicate={() => duplicateMut.mutate(id)}
                onMove={() => setMoveFor(s)}
                onDelete={() => setDeleteFor(s)}
                onCreateItem={(data) =>
                  createItemMut.mutate({ sectionId: id, data })
                }
                onPatchItem={(itemId, body) =>
                  patchItemMut.mutate({ itemId, body })
                }
                onRemoveItem={(itemId) => removeItemMut.mutate(itemId)}
                onReorderItems={(ids) =>
                  orderItemsMut.mutate({ sectionId: id, ids })
                }
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
                canMoveUp={canUp}
                canMoveDown={canDown}
              />
            );
          })
        )}
      </Stack>

      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={() => setPaletteOpen(true)}>
          Add section
        </Button>
      </Box>
    </>
  );

  return (
    <>
      {/* One tree in both layouts so opening the preview never remounts
          the section cards. With the column open both columns fill the
          viewport under the app bar and scroll on their own, so the
          preview stays in view while the editor scrolls. */}
      <Box
        sx={
          showColumn
            ? { display: "flex", gap: 2, height: "calc(100vh - 96px)", minHeight: 0 }
            : undefined
        }
        data-testid="page-editor-split"
      >
        <Box
          sx={
            showColumn
              ? {
                  flex: `0 0 ${EDITOR_MIN_WIDTH}px`,
                  minWidth: EDITOR_MIN_WIDTH,
                  overflowY: "auto",
                  pr: 1,
                }
              : undefined
          }
        >
          {editor}
        </Box>
        {showColumn ? (
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              p: 1.5,
            }}
            data-testid="page-preview-column"
          >
            <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                Preview
              </Typography>
              <Tooltip title="Close preview">
                <IconButton
                  aria-label="Close preview"
                  onClick={() => setColumnOpen(false)}
                  data-testid="page-preview-close"
                >
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <PreviewPane
                active
                initialSlug={page.slug ?? null}
                showPageSelector={false}
                title={`Preview of ${page.title ?? "the page"}`}
                defaultDevice="desktop"
                reloadSignal={saveCount}
              />
            </Box>
          </Paper>
        ) : null}
      </Box>

      <PreviewFrame
        open={previewDialogOpen && !showColumn}
        onClose={() => setPreviewDialogOpen(false)}
        initialSlug={page.slug ?? null}
        showPageSelector={false}
        title={`Preview of ${page.title ?? "the page"}`}
        reloadSignal={saveCount}
      />

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

      <MoveSectionDialog
        open={Boolean(moveFor)}
        pages={(pagesQ.data?.items ?? []) as PageAdmin[]}
        currentPageId={pageId}
        kind={moveFor ? kindByName[moveFor.kind ?? ""] ?? null : null}
        onCancel={() => setMoveFor(null)}
        onMove={(target) => {
          if (!moveFor) return;
          moveMut.mutate({
            sectionId: Number(moveFor.id ?? 0),
            targetPageId: Number(target.id ?? 0),
            position: Number(target.sectionCount ?? 0),
          });
        }}
      />
    </>
  );
}
