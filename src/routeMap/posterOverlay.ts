// The overlay layer of the poster export: the layout's elements drawn by
// an offscreen Konva stage and rendered at the print pixel scale, so the
// composed poster lays them out exactly as the composer over the preview
// does (both place them through elementPixels).

import Konva from "konva";
import type { OverlayImage } from "./overlayImage";
import type { PosterSize } from "./poster";
import { elementPixels, type LayoutElement } from "./posterLayout";

// The CSS width of the offscreen stage; toCanvas scales it to the print
// width, and svg images rasterise at that scale.
export const OVERLAY_STAGE_WIDTH = 1000;

// Draws `elements` in stacking order, each with its loaded image
// (`images[i]` belongs to `elements[i]`), and returns a canvas of
// exactly `size` pixels.
export function renderOverlayCanvas(
  elements: readonly LayoutElement[],
  images: readonly OverlayImage[],
  size: PosterSize,
): HTMLCanvasElement {
  const stageSize = {
    width: OVERLAY_STAGE_WIDTH,
    height: (OVERLAY_STAGE_WIDTH * size.height) / size.width,
  };
  const container = document.createElement("div");
  const stage = new Konva.Stage({ container, ...stageSize });
  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    elements.forEach((el, i) => {
      const loaded = images[i];
      if (!loaded) throw new Error("An overlay image is missing.");
      const px = elementPixels(el, stageSize, loaded.aspect);
      layer.add(
        new Konva.Image({
          image: loaded.image,
          x: px.x,
          y: px.y,
          width: px.width,
          height: px.height,
          offsetX: px.width / 2,
          offsetY: px.height / 2,
          rotation: px.rotation,
        }),
      );
    });
    const rendered = stage.toCanvas({ pixelRatio: size.width / OVERLAY_STAGE_WIDTH });
    if (rendered.width === size.width && rendered.height === size.height) return rendered;
    // Rounding can leave the canvas a pixel off; the copy is exact.
    const exact = document.createElement("canvas");
    exact.width = size.width;
    exact.height = size.height;
    const ctx = exact.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw the poster image.");
    ctx.drawImage(rendered, 0, 0, size.width, size.height);
    return exact;
  } finally {
    stage.destroy();
  }
}
