// Loads the images the poster overlays draw. Every image loads with
// crossOrigin "anonymous" and is checked on a scratch canvas, so an image
// that would taint the export canvas fails here, with a reason, instead of
// at the encode.

export const OVERLAY_IMAGE_TIMEOUT_MS = 30_000;

export type OverlayImage = {
  image: HTMLImageElement;
  // Height over width.
  aspect: number;
};

// Throws when reading the canvas back after drawing the image is refused,
// which is what happens to an image served without CORS headers.
function assertReadable(image: HTMLImageElement): void {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(image, 0, 0, 1, 1);
  ctx.getImageData(0, 0, 1, 1);
}

// Loads `url` into an image element. `fallbackAspect` stands in when the
// image has no intrinsic size (an svg without width and height).
export function loadOverlayImage(url: string, fallbackAspect = 1): Promise<OverlayImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    const timer = setTimeout(() => {
      image.src = "";
      reject(new Error("The image took too long to load."));
    }, OVERLAY_IMAGE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      try {
        assertReadable(image);
      } catch {
        reject(
          new Error(
            "The image host does not allow the image on a canvas (no cross-origin access), so the poster could not be exported with it.",
          ),
        );
        return;
      }
      const aspect =
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? image.naturalHeight / image.naturalWidth
          : fallbackAspect;
      resolve({ image, aspect });
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("The image could not be loaded."));
    };
    image.src = url;
  });
}

// The data URL of an svg document, for loading it through an image
// element.
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
