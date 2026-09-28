// A stand-in for `konva` in tests: jsdom has no canvas to draw on. It
// records the images each offscreen stage draws and the pixel ratio it
// renders at.

export type DrawnImage = {
  image: unknown;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export const konvaLog = {
  stages: [] as Array<{ images: DrawnImage[]; pixelRatio: number | null; canvas: HTMLCanvasElement | null }>,
};

class Node<T> {
  constructor(public attrs: T) {}
}

class Image extends Node<DrawnImage> {}

class Layer {
  children: Image[] = [];
  add(node: Image) {
    this.children.push(node);
  }
}

class Stage {
  private layers: Layer[] = [];
  private entry: (typeof konvaLog.stages)[number] = { images: [], pixelRatio: null, canvas: null };
  constructor(private attrs: { width: number; height: number }) {
    konvaLog.stages.push(this.entry);
  }
  add(layer: Layer) {
    this.layers.push(layer);
  }
  toCanvas({ pixelRatio }: { pixelRatio: number }) {
    this.entry.images = this.layers.flatMap((l) => l.children.map((c) => c.attrs));
    this.entry.pixelRatio = pixelRatio;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(this.attrs.width * pixelRatio);
    canvas.height = Math.round(this.attrs.height * pixelRatio);
    this.entry.canvas = canvas;
    return canvas;
  }
  destroy() {
    return undefined;
  }
}

const Konva = { Stage, Layer, Image };
export default Konva;
