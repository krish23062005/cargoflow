"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type BarcodeDetectorLike = {
  detect: (source: unknown) => Promise<{ rawValue: string }[]>;
};

function getDetector(): BarcodeDetectorLike | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as unknown as { BarcodeDetector?: new (o: object) => BarcodeDetectorLike }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

const subscribe = () => () => {};
/** Hydration-safe environment probe: false during SSR, real value on device. */
function probeClientSupport(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(getDetector()) && "mediaDevices" in navigator;
}

/**
 * QR scanner for delivery slips. Uses the native BarcodeDetector API when
 * available (Chrome on Android — ideal for the driver PWA) and falls back to
 * manual entry of the verification code otherwise.
 */
export function QrScanner({ onDetected }: { onDetected: (payload: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const supported = useSyncExternalStore(subscribe, probeClientSupport, probeClientSupport);

  useEffect(() => {
    return () => {
      if (loopTimer.current) clearTimeout(loopTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function stop() {
    if (loopTimer.current) clearTimeout(loopTimer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function start() {
    const detector = getDetector();
    const video = videoRef.current;
    if (!detector || !video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setScanning(true);
      const tick = () => {
        const det = getDetector();
        if (!det || !streamRef.current) return;
        void det
          .detect(video)
          .then(async (codes) => {
            if (!streamRef.current) return;
            const value = codes[0]?.rawValue;
            if (value) {
              stop();
              onDetected(value);
              return;
            }
            loopTimer.current = setTimeout(tick, 300);
          })
          .catch(() => {
            loopTimer.current = setTimeout(tick, 1000);
          });
      };
      tick();
    } catch {
      setScanning(false);
    }
  }

  return (
    <div>
      {supported ? (
        <div className="rounded-xl border p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void start()}
            disabled={scanning}
          >
            <ScanLine className="mr-2 size-4" />
            {scanning ? "Scanning… (tap to stop)" : "Scan delivery QR"}
          </Button>
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn(
              "mx-auto mt-2 aspect-square w-full max-w-[200px] rounded-lg bg-black object-cover",
              scanning ? "" : "hidden",
            )}
          />
          {scanning ? (
            <p className="mt-2 text-center text-xs text-emerald-600">
              Hold the label steady inside the frame.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            QR scanning isn&apos;t supported on this browser. Enter the tracking number shown on the
            delivery slip:
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) onDetected(manual.trim());
            }}
          >
            <div className="flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Tracking number"
                className="flex-1"
              />
              <Button type="submit">Check</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}