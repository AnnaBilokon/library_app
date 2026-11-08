"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Loader2, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isbnFromBarcode } from "@/lib/isbn";

/** What `detect()` needs from either detector: the browser's own, or the WebAssembly one. */
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

/**
 * The browser's BarcodeDetector where it reads EAN-13 (Chrome on Android, Chrome on a Mac);
 * elsewhere (iPhone, Firefox, Chrome on Windows) the same API built on zxing-wasm. That one is
 * only downloaded here, on the first scan: about 1 MB, from jsDelivr.
 */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } })
    .BarcodeDetector;
  if (Native && (await Native.getSupportedFormats().catch((): string[] => [])).includes("ean_13")) {
    return new Native({ formats: ["ean_13"] });
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: ["ean_13"] });
}

function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "Camera access is blocked. Allow it in your browser's site settings, or type the ISBN.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found. Type the ISBN instead.";
  if (name === "NotReadableError") return "The camera is busy in another app. Close it and try again.";
  return "Couldn't start the camera. Type the ISBN instead.";
}

/** A camera button: scan the barcode on a book's back cover and get its ISBN-13. */
export function ScanIsbnButton({ onScan }: { onScan: (isbn: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="icon" className="size-10 shrink-0 bg-background" onClick={() => setOpen(true)}>
        <ScanBarcode aria-hidden />
        <span className="sr-only">Scan a barcode</span>
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Scan the barcode</DialogTitle>
              <DialogDescription>Point the camera at the barcode on the back cover, the one under &ldquo;ISBN&rdquo;.</DialogDescription>
            </DialogHeader>
            <Scanner
              onScan={(isbn) => {
                setOpen(false);
                onScan(isbn);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** The camera view. It runs while mounted, and turns the camera off when it unmounts. */
function Scanner({ onScan }: { onScan: (isbn: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "not-isbn">("starting");
  const [error, setError] = useState<string | null>(null);
  // The latest onScan, so the camera effect below runs once instead of restarting on each render.
  const found = useEffectEvent(onScan);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't use the camera here. Type the ISBN instead.");
        return;
      }
      let detector: Detector;
      try {
        [stream, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }),
          createDetector(),
        ]);
      } catch (e) {
        setError(cameraError(e));
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setStatus("scanning");

      // A few reads a second: quick enough to feel instant, light enough for an old phone.
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
          const codes = await detector.detect(video).catch(() => []);
          const isbn = codes.map((c) => isbnFromBarcode(c.rawValue)).find(Boolean);
          if (isbn && !stopped) {
            navigator.vibrate?.(60);
            found(isbn);
            return;
          }
          if (codes.length > 0) setStatus("not-isbn");
        }
        timer = setTimeout(tick, 200);
      };
      tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} muted playsInline className="size-full object-cover" />
        {/* Where to hold the barcode: a wide box across the middle. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-[12%] top-1/2 h-1/3 -translate-y-1/2 rounded-md border-2 border-white/80" />
        {status === "starting" && (
          <Loader2 className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" aria-hidden />
        )}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {status === "starting"
          ? "Starting the camera…"
          : status === "not-isbn"
            ? "That barcode isn't an ISBN. Look for the one starting 978 or 979."
            : "Hold the book steady, about a hand's width away."}
      </p>
    </div>
  );
}
