import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

// The rendered height of the element behind `ref` in px, or null while the
// element is unmounted or has no height yet. The first height is read from
// `getBoundingClientRect` when the element mounts; later sizes come from a
// `ResizeObserver`, created only where the global exists and disconnected
// when the element goes away or the component unmounts. The effect runs on
// every render so an element that mounts after the first render (behind a
// loading state) is picked up.
export function useElementHeight(
  ref: RefObject<HTMLElement | null>
): number | null {
  const [height, setHeight] = useState<number | null>(null);
  const tracked = useRef<{
    el: HTMLElement | null;
    observer: ResizeObserver | null;
  }>({ el: null, observer: null });

  useEffect(() => {
    const el = ref.current;
    const current = tracked.current;
    if (el === current.el) return;
    current.observer?.disconnect();
    current.el = el;
    current.observer = null;
    if (!el) {
      setHeight(null);
      return;
    }
    const measured = el.getBoundingClientRect().height;
    setHeight(measured > 0 ? measured : null);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[entries.length - 1]?.contentRect.height ?? 0;
      setHeight(next > 0 ? next : null);
    });
    current.observer = observer;
    observer.observe(el);
  });

  useEffect(() => {
    const current = tracked.current;
    return () => {
      current.observer?.disconnect();
      current.observer = null;
      current.el = null;
    };
  }, []);

  return height;
}
