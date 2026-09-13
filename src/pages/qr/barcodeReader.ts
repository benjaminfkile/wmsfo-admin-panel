// admin.md 6.25: read QR codes through the `BarcodeDetector` API where
// present, else fall back to `@zxing/browser`. The reader here is a
// thin abstraction so the Scan page tests can inject a fake instead of
// asking jsdom to spin up a camera.

export type CodeReader = {
  start: (video: HTMLVideoElement, onRead: (text: string) => void) => Promise<void>;
  stop: () => void;
};

export type CodeReaderFactory = () => CodeReader;

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

// Snapshot the detector at module load so a test can install a global
// before the component mounts.
function getBarcodeDetector(): BarcodeDetectorCtor | null {
  const w = globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return typeof w.BarcodeDetector === "function" ? w.BarcodeDetector : null;
}

function makeBarcodeDetectorReader(Ctor: BarcodeDetectorCtor): CodeReader {
  let stream: MediaStream | null = null;
  let raf: number | null = null;
  let cancelled = false;
  const detector = new Ctor({ formats: ["qr_code"] });

  return {
    async start(video, onRead) {
      cancelled = false;
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play().catch(() => undefined);
      let last: string | null = null;
      const tick = async () => {
        if (cancelled) return;
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;
          if (value && value !== last) {
            last = value;
            onRead(value);
          }
        } catch {
          // A frame that cannot be decoded is normal; keep polling.
        }
        raf = requestAnimationFrame(() => void tick());
      };
      void tick();
    },
    stop() {
      cancelled = true;
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
      }
      stream = null;
    },
  };
}

// Lazily import `@zxing/browser` so a jsdom test that never scans does
// not have to load its bundle.
async function makeZxingReader(): Promise<CodeReader> {
  const { BrowserQRCodeReader } = await import("@zxing/browser");
  const reader = new BrowserQRCodeReader();
  let controls: { stop: () => void } | null = null;
  let cancelled = false;

  return {
    async start(video, onRead) {
      cancelled = false;
      let last: string | null = null;
      controls = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result) => {
          if (cancelled || !result) return;
          const text = result.getText();
          if (text && text !== last) {
            last = text;
            onRead(text);
          }
        },
      );
    },
    stop() {
      cancelled = true;
      controls?.stop();
      controls = null;
    },
  };
}

// The panel picks the platform reader once; the browser will not sprout
// `BarcodeDetector` after the page loads.
export function defaultReaderFactory(): CodeReader {
  const Ctor = getBarcodeDetector();
  if (Ctor) return makeBarcodeDetectorReader(Ctor);

  // The zxing reader is async to construct; return a lazy shim that
  // forwards start/stop through to the real reader.
  let pending: Promise<CodeReader> | null = null;
  let real: CodeReader | null = null;
  const ensure = () => {
    if (!pending) pending = makeZxingReader().then((r) => (real = r));
    return pending;
  };
  return {
    async start(video, onRead) {
      const r = await ensure();
      return r.start(video, onRead);
    },
    stop() {
      real?.stop();
    },
  };
}
