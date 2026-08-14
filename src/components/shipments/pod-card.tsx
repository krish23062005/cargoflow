"use client";

import { BadgeCheck, MapPin, ScanLine, User } from "lucide-react";
import { api } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PodCard({ shipmentId }: { shipmentId: string }) {
  const proofQuery = api.pod.getForShipment.useQuery({ shipmentId });
  const qrQuery = api.pod.qr.useQuery({ shipmentId });

  const proof = proofQuery.data ?? null;
  const qr = qrQuery.data ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BadgeCheck className="size-4" /> Proof of delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {/* Delivery QR — printed on the cargo label */}
        <div className="sm:col-span-2 rounded-xl border bg-muted/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ScanLine className="size-3.5" /> Delivery QR
          </p>
          {qrQuery.isLoading ? (
            <Skeleton className="h-20 w-20" />
          ) : qr ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.dataUrl}
                alt="Shipment delivery QR"
                className="size-20 shrink-0 rounded-lg border bg-white p-1"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Print this on the cargo label. The driver scans it to confirm the delivery.
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {qr.payload.replace(/^CFV1:/, "")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Could not generate QR.</p>
          )}
        </div>

        {proofQuery.isLoading ? (
          <div className="space-y-3 sm:col-span-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : proof ? (
          <>
            <div className="sm:col-span-2 grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {proof.recipientName}
                    {proof.recipientPhone ? ` · ${proof.recipientPhone}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {proof.capturedByName ? `Captured by ${proof.capturedByName}` : "Captured"}
                    {" · "}
                    {new Date(proof.capturedAt).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600">
                  Captured
                </span>
              </div>

              {proof.locationLat != null && proof.locationLng != null ? (
                <a
                  href={`https://www.google.com/maps?q=${proof.locationLat},${proof.locationLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <MapPin className="size-3.5" />
                  {proof.locationLat.toFixed(4)}, {proof.locationLng.toFixed(4)}
                </a>
              ) : null}

              {proof.photos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {proof.photos.map((p, i) => (
                    <a
                      key={i}
                      href={p.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square overflow-hidden rounded-lg border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.dataUrl} alt={`Delivery photo ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}

              {proof.signature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proof.signature}
                  alt="Recipient signature"
                  className="h-24 w-full rounded-lg border bg-white object-contain"
                />
              ) : null}

              {proof.notes ? (
                <p className="text-xs italic text-muted-foreground">“{proof.notes}”</p>
              ) : null}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="size-3.5" />
              {proof.capturedByName ?? "No driver name recorded"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No proof yet — the driver captures photos, signature and recipient details on delivery.
          </p>
        )}
      </CardContent>
    </Card>
  );
}