"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPin, Package, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QrScanner } from "@/components/driver/qr-scanner";
import { CameraCapture, type CapturedPhoto } from "@/components/driver/camera-capture";
import { SignaturePad } from "@/components/driver/signature-pad";
import { offlineCapablePost } from "@/lib/offline/mutations";
import { cn } from "@/lib/utils";

export type PodInitial = {
  shipmentId: string;
  trackingNumber: string;
  originAddress: string;
  destinationAddress: string;
  customerName: string;
  driverName: string;
  qr: { trackingNumber: string; payload: string; dataUrl: string } | null;
  proof: {
    recipientName: string;
    recipientPhone: string | null;
    notes: string | null;
    capturedByName: string | null;
    capturedAt: string;
    signature: string | null;
    photos: CapturedPhoto[];
  } | null;
};

function verificationCode(payload: string | null | undefined): string {
  if (!payload) return "";
  const sep = payload.lastIndexOf("|");
  return sep >= 0 ? payload.slice(sep + 1) : "";
}

export function PodCapture({ initial }: { initial: PodInitial }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [scanState, setScanState] = useState<"idle" | "pending" | "verified" | "mismatch">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    router.prefetch("/driver");
  }, [router]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* location optional */
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  function onScanned(payload: string) {
    if (!initial.qr) return;
    const normalized = payload.trim();
    const matches =
      normalized === initial.qr.payload ||
      normalized === initial.trackingNumber ||
      normalized.startsWith(initial.trackingNumber);
    setScanState(matches ? "verified" : "mismatch");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientName.trim()) {
      setError("Recipient name is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await offlineCapablePost(
        "/api/driver/pod",
        {
          shipmentId: initial.shipmentId,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim() || null,
          notes: notes.trim() || null,
          photos,
          signature,
          locationLat: location?.lat ?? null,
          locationLng: location?.lng ?? null,
        },
        "pod",
      );
      if (result.queued) {
        setQueued(true);
        setDone(true);
        return;
      }
      if (!result.sent) {
        const data = result.body as { error?: string } | null;
        setError(data?.error ?? "Could not save proof of delivery.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
          <CheckCircle2 className="size-9" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">
            {queued ? "Proof queued" : "Delivery confirmed"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {queued
              ? `Proof for ${initial.trackingNumber} is saved on this device and will upload automatically when you're back online.`
              : `Proof saved for ${initial.trackingNumber}. The customer was marked delivered and your team is notified.`}
          </p>
        </div>
        <dl className="w-full rounded-xl border p-4 text-left text-sm">
          <div className="flex justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="size-3.5" /> Tracking
            </dt>
            <dd className="font-medium">{initial.trackingNumber}</dd>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" /> Location
            </dt>
            <dd className="font-medium">
              {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "—"}
            </dd>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <dt className="text-muted-foreground">Verification</dt>
            <dd className="font-mono font-medium">{verificationCode(initial.qr?.payload) || "—"}</dd>
          </div>
        </dl>
        <Button className="w-full" onClick={() => router.replace("/driver")}>
          Back to home
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Proof of delivery</h1>
          <p className="text-xs text-muted-foreground">{initial.trackingNumber}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.replace("/driver")}>
          <RotateCcw className="mr-1.5 size-4" />
          Home
        </Button>
      </header>

      {/* Shipment + label verification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4 text-muted-foreground" />
            {initial.trackingNumber}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {initial.originAddress} → {initial.destinationAddress}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3">
          {initial.qr ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={initial.qr.dataUrl} alt="Delivery QR" className="size-20 shrink-0 rounded-lg border bg-white p-1" />
              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Delivery QR</p>
                <p className="mt-1 font-mono text-[11px] break-all">
                  {verificationCode(initial.qr.payload) || initial.trackingNumber}
                </p>
              </div>
            </div>
          ) : null}

          {initial.proof ? (
            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Proof already captured on{" "}
              {new Date(initial.proof.capturedAt).toLocaleString()} by {initial.proof.capturedByName ?? "—"}. You
              can still add another.
            </p>
          ) : null}

          <QrScanner onDetected={onScanned} />
          {scanState === "verified" ? (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
              Verified ✓ — this label matches your active shipment.
            </p>
          ) : scanState === "mismatch" ? (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">
              That code does not match your active shipment.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <form onSubmit={submit} className="mt-4 grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="recipientName">Recipient name *</Label>
              <Input
                id="recipientName"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={initial.customerName}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recipientPhone">Recipient phone</Label>
              <Input
                id="recipientPhone"
                type="tel"
                inputMode="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. 0803 123 4567"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="podNotes">Notes</Label>
              <Textarea
                id="podNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Left with security at main gate"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <CameraCapture photos={photos} onChange={setPhotos} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recipient signature</CardTitle>
          </CardHeader>
          <CardContent>
            <SignaturePad onChange={setSignature} />
          </CardContent>
        </Card>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sticky bottom-20 z-10">
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Saving…" : "Confirm delivery"}
          </Button>
          <p
            className={cn(
              "mt-1.5 flex items-center justify-center gap-1 text-[11px]",
              location ? "text-muted-foreground" : "text-amber-600",
            )}
          >
            <MapPin className="size-3" />
            {location ? "Your location will be attached" : "Waiting for GPS location…"}
          </p>
        </div>
      </form>
      <div className="h-6" />
    </div>
  );
}