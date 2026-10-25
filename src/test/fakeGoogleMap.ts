// A stand-in for google.maps.Map in the tests that mock the loader: it
// keeps its centre, zoom, options, and listeners, and `pan` plays an
// admin's drag that ends in an idle.
type Point = { lat: number; lng: number };
type Bounds = { west: number; south: number; east: number; north: number };

export class FakeMap {
  static instances: FakeMap[] = [];

  div: HTMLElement;
  opts: Record<string, unknown>;
  options: Record<string, unknown> = {};
  center: Point = { lat: 0, lng: 0 };
  zoom = 3;
  fitted: Bounds[] = [];
  listeners: Record<string, Array<() => void>> = {};

  constructor(div: HTMLElement, opts: Record<string, unknown> = {}) {
    this.div = div;
    this.opts = opts;
    FakeMap.instances.push(this);
  }

  fitBounds(b: Bounds) {
    this.fitted.push(b);
    this.center = { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 };
  }

  setOptions(o: Record<string, unknown>) {
    Object.assign(this.options, o);
  }

  addListener(name: string, cb: () => void) {
    (this.listeners[name] ??= []).push(cb);
    return {
      remove: () => {
        this.listeners[name] = (this.listeners[name] ?? []).filter((x) => x !== cb);
      },
    };
  }

  getCenter() {
    const c = this.center;
    return { lat: () => c.lat, lng: () => c.lng };
  }

  getZoom() {
    return this.zoom;
  }

  setCenter(c: Point) {
    this.center = { ...c };
  }

  setZoom(z: number) {
    this.zoom = z;
  }

  fire(name: string) {
    for (const cb of this.listeners[name] ?? []) cb();
  }

  // The admin drags the map to `center` at `zoom`, and it idles.
  pan(center: Point, zoom: number) {
    this.fire("dragstart");
    this.center = { ...center };
    this.zoom = zoom;
    this.fire("idle");
  }
}

// The start view field's map, once it has loaded.
export function startViewMap(): FakeMap | undefined {
  return FakeMap.instances.find((m) => m.div.dataset.testid === "start-view-map");
}
