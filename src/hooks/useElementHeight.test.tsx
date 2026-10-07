import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { useElementHeight } from "./useElementHeight";

type Callback = (entries: { contentRect: { height: number } }[]) => void;

// A stand-in `ResizeObserver`: it records its callback, and `observe`
// reports `nextHeight` as the element's content height.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  static nextHeight = 480;
  callback: Callback;
  disconnected = false;
  constructor(callback: Callback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe() {
    this.callback([
      { contentRect: { height: FakeResizeObserver.nextHeight } },
    ]);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

function Probe({ onHeight }: { onHeight: (h: number | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useElementHeight(ref);
  onHeight(height);
  return (
    <div ref={ref} data-testid="probe">
      {height === null ? "none" : String(height)}
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeResizeObserver.instances = [];
});

describe("useElementHeight", () => {
  it("returns null before the first measure, the observed height after, and disconnects on unmount", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const seen: (number | null)[] = [];
    const { unmount } = render(<Probe onHeight={(h) => seen.push(h)} />);
    expect(seen[0]).toBeNull();
    expect(screen.getByTestId("probe")).toHaveTextContent("480");
    expect(FakeResizeObserver.instances).toHaveLength(1);
    const observer = FakeResizeObserver.instances[0]!;
    act(() => observer.callback([{ contentRect: { height: 300 } }]));
    expect(screen.getByTestId("probe")).toHaveTextContent("300");
    unmount();
    expect(observer.disconnected).toBe(true);
  });

  it("reads the getBoundingClientRect height when ResizeObserver is missing", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      height: 250,
    } as DOMRect);
    render(<Probe onHeight={() => undefined} />);
    expect(screen.getByTestId("probe")).toHaveTextContent("250");
  });
});
