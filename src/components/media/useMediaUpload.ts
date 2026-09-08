import { useCallback, useEffect, useRef, useState } from "react";
import { media as mediaApi } from "../../api/resources/media";
import {
  UploadFailed,
  uploadToS3,
} from "../../api/resources/upload";
import {
  checkSize,
  contentTypeFor,
  sizeIssueMessage,
  sniff,
  type SniffedType,
} from "../../validation/image";
import type { MediaAsset } from "../../api/types";

// Admin.md 6.15: several files upload in parallel, at most three at a time,
// each moving through pre-check → upload-url → PUT → confirm. Errors leave
// the row in a failed state with a Retry that either re-runs confirm (when
// only that step failed) or restarts the whole sequence.

export type UploadStage =
  | "queued"
  | "checking"
  | "prechecked"
  | "requesting"
  | "uploading"
  | "confirming"
  | "ready"
  | "failed";

export type UploadItem = {
  id: string;
  file: File;
  filename: string;
  size: number;
  sniffed: SniffedType;
  alt: string;
  title: string;
  stage: UploadStage;
  progress: number;
  error: string | null;
  errorFrom: "precheck" | "ticket" | "put" | "confirm" | null;
  mediaId: string | null;
  asset: MediaAsset | null;
};

export type UploadMeta = { alt?: string; title?: string };
const MAX_CONCURRENT = 3;

let counter = 0;
const nextId = () => {
  counter += 1;
  return `upload-${counter}`;
};

export type MediaUploadApi = {
  items: UploadItem[];
  add: (files: File[], meta?: UploadMeta) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  updateMeta: (id: string, meta: UploadMeta) => void;
};

export function useMediaUpload(
  onReady?: (asset: MediaAsset) => void
): MediaUploadApi {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;
  const activeRef = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const setItem = useCallback(
    (id: string, patch: Partial<UploadItem>): void => {
      // Mirror the update into itemsRef synchronously so pump's next
      // iteration cannot pick the same row again before render.
      itemsRef.current = itemsRef.current.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      );
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    []
  );

  const runUploadRef = useRef<(row: UploadItem) => Promise<void>>(
    async () => undefined
  );

  const pump = useCallback((): void => {
    while (activeRef.current < MAX_CONCURRENT) {
      const next = itemsRef.current.find((r) => r.stage === "prechecked");
      if (!next) return;
      activeRef.current += 1;
      // Move to "requesting" so the while loop's next iteration
      // does not pick this row again.
      setItem(next.id, { stage: "requesting", error: null, errorFrom: null });
      const started = itemsRef.current.find((r) => r.id === next.id) ?? next;
      void runUploadRef.current(started).finally(() => {
        activeRef.current = Math.max(0, activeRef.current - 1);
        setTimeout(() => pump(), 0);
      });
    }
  }, [setItem]);

  const runUpload = useCallback(
    async function runUpload(row: UploadItem): Promise<void> {
      // Content type from the sniff, not the file's declared type.
      if (row.sniffed === null) {
        setItem(row.id, {
          stage: "failed",
          error: "Unsupported image type",
          errorFrom: "precheck",
        });
        return;
      }
      const contentType = contentTypeFor(row.sniffed);
      const filename = sanitizeFilename(row.file.name);
      let ticket;
      try {
        ticket = await mediaApi.uploadUrl({
          filename,
          contentType,
          sizeBytes: row.file.size,
          alt: row.alt,
          title: row.title,
        });
      } catch (e) {
        setItem(row.id, {
          stage: "failed",
          error: e instanceof Error ? e.message : "Upload ticket failed",
          errorFrom: "ticket",
        });
        return;
      }
      const mediaId =
        typeof ticket.media?.id === "string" ? ticket.media.id : null;
      if (!ticket.uploadUrl || !mediaId) {
        setItem(row.id, {
          stage: "failed",
          error: "Upload ticket incomplete",
          errorFrom: "ticket",
        });
        return;
      }
      setItem(row.id, { stage: "uploading", mediaId, progress: 0 });
      try {
        await uploadToS3(
          {
            media: ticket.media,
            uploadUrl: ticket.uploadUrl,
            method: ticket.method,
            headers: ticket.headers,
            expiresAt: ticket.expiresAt,
          },
          row.file,
          (fraction) => setItem(row.id, { progress: fraction })
        );
      } catch (e) {
        const msg =
          e instanceof UploadFailed
            ? `Upload failed (${e.status})`
            : e instanceof Error
              ? e.message
              : "Upload failed";
        setItem(row.id, { stage: "failed", error: msg, errorFrom: "put" });
        return;
      }
      setItem(row.id, { stage: "confirming" });
      try {
        const asset = await mediaApi.confirm(mediaId);
        setItem(row.id, { stage: "ready", asset, mediaId: asset.id ?? mediaId });
        onReadyRef.current?.(asset);
      } catch (e) {
        setItem(row.id, {
          stage: "failed",
          error: e instanceof Error ? e.message : "Confirm failed",
          errorFrom: "confirm",
        });
      }
    },
    [setItem]
  );
  runUploadRef.current = runUpload;

  const add = useCallback(
    (files: File[], meta?: UploadMeta): void => {
      const rows: UploadItem[] = files.map((file) => ({
        id: nextId(),
        file,
        filename: sanitizeFilename(file.name),
        size: file.size,
        sniffed: null,
        alt: meta?.alt ?? "",
        title: meta?.title ?? "",
        stage: "checking",
        progress: 0,
        error: null,
        errorFrom: null,
        mediaId: null,
        asset: null,
      }));
      setItems((prev) => [...prev, ...rows]);
      // Run sniff+size checks then move to prechecked.
      for (const row of rows) {
        void sniff(row.file).then((sniffed) => {
          const issue = checkSize(row.file.size, sniffed);
          if (issue) {
            setItem(row.id, {
              stage: "failed",
              error: sizeIssueMessage(issue),
              errorFrom: "precheck",
              sniffed,
            });
          } else {
            setItem(row.id, { stage: "prechecked", sniffed });
          }
        });
      }
    },
    [setItem]
  );

  const retry = useCallback(
    (id: string): void => {
      const row = itemsRef.current.find((r) => r.id === id);
      if (!row) return;
      if (row.errorFrom === "confirm" && row.mediaId) {
        // Repeat just the confirm step.
        setItem(id, { stage: "confirming", error: null, errorFrom: null });
        void (async () => {
          try {
            const asset = await mediaApi.confirm(row.mediaId!);
            setItem(id, { stage: "ready", asset });
            onReadyRef.current?.(asset);
          } catch (e) {
            setItem(id, {
              stage: "failed",
              error: e instanceof Error ? e.message : "Confirm failed",
              errorFrom: "confirm",
            });
          }
        })();
        return;
      }
      if (row.errorFrom === "precheck") return; // cannot retry a rejected file
      // Restart the full sequence.
      setItem(id, {
        stage: "prechecked",
        error: null,
        errorFrom: null,
        progress: 0,
        mediaId: null,
      });
      pump();
    },
    [pump, setItem]
  );

  const remove = useCallback((id: string): void => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clear = useCallback((): void => {
    setItems((prev) => prev.filter((r) => r.stage !== "ready"));
  }, []);

  const updateMeta = useCallback(
    (id: string, meta: UploadMeta): void => {
      const row = itemsRef.current.find((r) => r.id === id);
      if (!row) return;
      if (row.stage === "checking" || row.stage === "prechecked") {
        setItem(id, {
          alt: meta.alt ?? row.alt,
          title: meta.title ?? row.title,
        });
      }
    },
    [setItem]
  );

  useEffect(() => {
    pump();
  }, [items, pump]);

  return { items, add, retry, remove, clear, updateMeta };
}

// Filenames are shown on cards and passed to the API. Match the API's
// sanitizer conservatively: keep letters, digits, dashes, dots, and
// underscores; collapse anything else to a dash; cap at 100 chars.
export function sanitizeFilename(name: string): string {
  const trimmed = name.trim().slice(-200); // don't fold huge inputs
  const cleaned = trimmed
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const capped = cleaned.length > 100 ? cleaned.slice(0, 100) : cleaned;
  return capped.length > 0 ? capped : "file";
}
