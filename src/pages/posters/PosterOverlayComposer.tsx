import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import {
  elementPixels,
  placementFromPixels,
  snapShift,
  type LayoutElement,
} from "../../routeMap/posterLayout";
import { sourceKey, type SourceState } from "./overlaySources";

// An element of the composer: the layout element and a key that is the
// element's identity while the dialog is open.
export type EditorElement = LayoutElement & { key: string };

interface Props {
  // The display size of the stage, the preview's size.
  width: number;
  height: number;
  elements: readonly EditorElement[];
  sources: Record<string, SourceState>;
  selectedKey: string | null;
  disabled: boolean;
  touch: boolean;
  onSelect: (key: string | null) => void;
  onChange: (key: string, placement: Pick<LayoutElement, "x" | "y" | "width" | "rotation">) => void;
  onDelete: (key: string) => void;
}

const MIN_SIZE_PX = 12;

type Guide = { vertical: boolean; at: number };

// The Konva stage over the poster preview that holds the overlay elements.
// A click or tap selects an element and puts the transformer on it (move,
// scale with the aspect kept, rotate); a drag snaps the element's edges and
// centre to the poster's edges and centre and shows the guide it snapped
// to; Delete or Backspace removes the selected element.
export default function PosterOverlayComposer({
  width,
  height,
  elements,
  sources,
  selectedKey,
  disabled,
  touch,
  onSelect,
  onChange,
  onDelete,
}: Props) {
  const trRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  const [guides, setGuides] = useState<Guide[]>([]);
  const size = { width, height };

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedKey ? nodes.current.get(selectedKey) : undefined;
    tr.nodes(node && !disabled ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedKey, elements, sources, disabled]);

  useEffect(() => {
    if (!selectedKey || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      onDelete(selectedKey);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedKey, disabled, onDelete]);

  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const box = node.getClientRect();
    const found: Guide[] = [];
    const sx = snapShift([box.x, box.x + box.width / 2, box.x + box.width], [0, width / 2, width]);
    if (sx) {
      node.x(node.x() + sx.shift);
      found.push({ vertical: true, at: sx.at });
    }
    const sy = snapShift([box.y, box.y + box.height / 2, box.y + box.height], [0, height / 2, height]);
    if (sy) {
      node.y(node.y() + sy.shift);
      found.push({ vertical: false, at: sy.at });
    }
    setGuides(found);
  };

  const commit = (key: string, node: Konva.Node) => {
    const scale = node.scaleX();
    const nodeWidth = node.width() * scale;
    node.scaleX(1);
    node.scaleY(1);
    onChange(
      key,
      placementFromPixels({ x: node.x(), y: node.y(), width: nodeWidth, rotation: node.rotation() }, size),
    );
  };

  const deselectOnEmpty = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) onSelect(null);
  };

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={deselectOnEmpty}
      onTouchStart={deselectOnEmpty}
      style={{ position: "absolute", left: 0, top: 0 }}
      data-testid="poster-overlay-stage"
    >
      <Layer>
        {elements.map((el) => {
          const state = sources[sourceKey(el)];
          const ready = state?.status === "ready" ? state : null;
          const aspect = ready ? ready.aspect : 1;
          const px = elementPixels(el, size, aspect);
          const common = {
            x: px.x,
            y: px.y,
            width: px.width,
            height: px.height,
            offsetX: px.width / 2,
            offsetY: px.height / 2,
            rotation: px.rotation,
            draggable: !disabled,
            name: `overlay-${el.type}`,
            onMouseDown: () => onSelect(el.key),
            onTap: () => onSelect(el.key),
            onDragStart: () => onSelect(el.key),
            onDragMove,
            onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
              setGuides([]);
              commit(el.key, e.target);
            },
            onTransformEnd: (e: Konva.KonvaEventObject<Event>) => commit(el.key, e.target),
            ref: (node: Konva.Node | null) => {
              if (node) nodes.current.set(el.key, node);
              else nodes.current.delete(el.key);
            },
          };
          return ready ? (
            <KonvaImage key={el.key} image={ready.image} {...common} />
          ) : (
            <Rect
              key={el.key}
              {...common}
              fill="rgba(128, 128, 128, 0.35)"
              stroke={state?.status === "failed" ? "#d32f2f" : "#9e9e9e"}
              strokeWidth={2}
              dash={[6, 4]}
            />
          );
        })}
        {guides.map((g, i) => (
          <Line
            key={i}
            points={g.vertical ? [g.at, 0, g.at, height] : [0, g.at, width, g.at]}
            stroke="#e91e63"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ))}
        <Transformer
          ref={trRef}
          keepRatio
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          rotationSnaps={[0, 90, 180, 270]}
          anchorSize={touch ? 18 : 10}
          rotateAnchorOffset={touch ? 36 : 24}
          boundBoxFunc={(oldBox, newBox) =>
            Math.abs(newBox.width) < MIN_SIZE_PX || Math.abs(newBox.height) < MIN_SIZE_PX ? oldBox : newBox
          }
        />
      </Layer>
    </Stage>
  );
}
