"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CapturedPhoto = { dataUrl: string; contentType: string };
const MAX_DIMENSION = 1280;
const MAX_PHOTOS = 4;

/** Resize an image file to a compressed data URL (kept under ~1 MB). */
async function fileToCompressedDataUrl(file: File): Promise<CapturedPhoto> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });

  const contentType = file.type === "image/png" ? "image/png" : "image/jpeg";

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode-failed"));
    el.src = raw;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unsupported");
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl =
    contentType === "image/png"
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", 0.8);

  return { dataUrl, contentType };
}

/**
 * Mobile camera capture (via the native capture flow) with previews and
 * compression. Emits up to `MAX_PHOTOS` photos through `onChange`.
 */
export function CameraCapture({
  photos,
  onChange,
}: {
  photos: CapturedPhoto[];
  onChange: (photos: CapturedPhoto[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await fileToCompressedDataUrl(file);
      onChange([...photos, photo].slice(0, MAX_PHOTOS));
    } catch {
      setError("Could not read that photo. Try another.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      <div className="grid grid-cols-4 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.dataUrl} alt={`Delivery photo ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "grid aspect-square place-items-center rounded-lg border border-dashed text-muted-foreground active:bg-accent",
              busy && "opacity-60",
            )}
          >
            <Camera className="size-5" />
            <span className="sr-only">Add photo</span>
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {photos.length}/{MAX_PHOTOS} photos{error ? ` · ${error}` : ""}
      </p>
    </div>
  );
}