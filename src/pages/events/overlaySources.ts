import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { media as mediaApi } from "../../api/resources/media";
import { keys } from "../../queries/keys";
import { loadOverlayImage, svgDataUrl, type OverlayImage } from "../../routeMap/overlayImage";
import { elementLabel, type LayoutElement } from "../../routeMap/posterLayout";
import { qrTargetUrl, renderQrCard } from "../qr/qrRender";

// The pixel size the QR card is rendered at. The card is an svg, so it
// stays sharp at any print scale; this only sets its intrinsic size.
export const QR_CARD_PX = 1024;

export type LoadedSource = OverlayImage & { filename: string | null };

export type SourceState =
  | { status: "loading" }
  | ({ status: "ready" } & LoadedSource)
  | { status: "failed"; error: string };

// The image an element draws: elements that show the same media asset or
// the same QR code share one load.
export function sourceKey(el: LayoutElement): string {
  return el.type === "qr" ? `qr:${el.qrId}:${el.tag}` : `media:${el.mediaId}`;
}

// A named overlay that could not load; the message names the element.
export class OverlayLoadError extends Error {}

async function loadSource(
  qc: QueryClient,
  el: LayoutElement,
  siteBaseUrl: string,
): Promise<LoadedSource> {
  if (el.type === "qr") {
    const svg = await renderQrCard(qrTargetUrl(siteBaseUrl, el.tag), QR_CARD_PX);
    const loaded = await loadOverlayImage(svgDataUrl(svg), 1);
    return { ...loaded, filename: null };
  }
  const asset = await qc.fetchQuery({
    queryKey: keys.mediaAsset(el.mediaId),
    queryFn: () => mediaApi.get(el.mediaId),
  });
  if (!asset.url) throw new Error("The media asset has no file.");
  const w = Number(asset.width ?? 0);
  const h = Number(asset.height ?? 0);
  const loaded = await loadOverlayImage(asset.url, w > 0 && h > 0 ? h / w : 1);
  return { ...loaded, filename: asset.filename ?? null };
}

function messageOf(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Unknown error.";
}

// Loads the image of every element once per source and tracks its state.
// A failed source stays failed while the elements are edited;
// `whenReady(elements)` loads the failed ones again, resolves with each
// element's image once they have all loaded, and rejects with an
// OverlayLoadError naming the first element that failed.
export function useOverlaySources(elements: readonly LayoutElement[], siteBaseUrl: string) {
  const qc = useQueryClient();
  const loads = useRef(new Map<string, Promise<LoadedSource>>());
  const failed = useRef(new Set<string>());
  const [states, setStates] = useState<Record<string, SourceState>>({});

  const ensure = useCallback(
    (el: LayoutElement, retry: boolean): Promise<LoadedSource> | null => {
      const key = sourceKey(el);
      if (failed.current.has(key)) {
        if (!retry) return null;
        failed.current.delete(key);
        loads.current.delete(key);
      }
      let load = loads.current.get(key);
      if (!load) {
        load = loadSource(qc, el, siteBaseUrl);
        loads.current.set(key, load);
        setStates((s) => ({ ...s, [key]: { status: "loading" } }));
        load.then(
          (loaded) => setStates((s) => ({ ...s, [key]: { status: "ready", ...loaded } })),
          (e: unknown) => {
            failed.current.add(key);
            setStates((s) => ({ ...s, [key]: { status: "failed", error: messageOf(e) } }));
          },
        );
      }
      return load;
    },
    [qc, siteBaseUrl],
  );

  useEffect(() => {
    for (const el of elements) void ensure(el, false)?.catch(() => undefined);
  }, [elements, ensure]);

  const whenReady = useCallback(
    async (list: readonly LayoutElement[]): Promise<LoadedSource[]> => {
      const out: LoadedSource[] = [];
      for (const el of list) {
        try {
          out.push(await ensure(el, true)!);
        } catch (e) {
          const filename =
            el.type === "image"
              ? (qc.getQueryData<{ filename?: string | null }>(keys.mediaAsset(el.mediaId))?.filename ?? null)
              : null;
          throw new OverlayLoadError(
            `The overlay ${elementLabel(el, filename)} could not be drawn. ${messageOf(e)}`,
          );
        }
      }
      return out;
    },
    [ensure, qc],
  );

  return { states, whenReady };
}
