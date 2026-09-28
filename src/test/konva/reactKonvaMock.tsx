// A stand-in for `react-konva` in tests: each node renders a plain element
// that carries its props as data attributes, so a test can find the
// overlay elements, read their placement, and select one with a click.
import { forwardRef, useImperativeHandle, type ReactNode } from "react";

type NodeProps = {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  image?: HTMLImageElement;
  onMouseDown?: () => void;
  onTap?: () => void;
};

export function Stage({ children, width, height }: { children?: ReactNode; width: number; height: number }) {
  return (
    <div data-testid="poster-overlay-stage" data-width={width} data-height={height}>
      {children}
    </div>
  );
}

export function Layer({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}

function attrs(p: NodeProps) {
  return {
    "data-name": p.name,
    "data-x": p.x,
    "data-y": p.y,
    "data-width": p.width,
    "data-height": p.height,
    "data-rotation": p.rotation,
    onMouseDown: () => p.onMouseDown?.(),
  };
}

export function Image(p: NodeProps) {
  return <div data-testid="poster-overlay-image" data-src={p.image?.src} {...attrs(p)} />;
}

export function Rect(p: NodeProps) {
  return <div data-testid="poster-overlay-placeholder" {...attrs(p)} />;
}

export function Line() {
  return null;
}

export const Transformer = forwardRef(function Transformer(_: unknown, ref) {
  useImperativeHandle(ref, () => ({
    nodes: () => undefined,
    getLayer: () => null,
  }));
  return null;
});
