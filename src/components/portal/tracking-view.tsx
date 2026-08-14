"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Box,
  CalendarClock,
  CheckCircle2,
  Copy,
  Link2,
  MapPin,
  Package,
  RefreshCw,
  Truck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import type { PortalData } from "@/server/portal";
import { getShipmentStatusLabel } from "@/lib/constants/shipments";
import { getCargoTypeLabel } from "@/lib/constants/shipments";
import { formatEtaDuration } from "@/lib/utils/eta-calculator";
import { ShipmentStatusBadge } from "@/components/shared/shipment-status-badge";
import { TrackingTimeline } from "@/components/portal/tracking-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PortalTrackingMap = dynamic(
  () => import("@/components/portal/tracking-map").then((m) => m.PortalTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] animate-pulse items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString() : "—";

function BrandHeader({ data }: { data: PortalData }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center gap-3">
        {data.organization.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.organization.logo}
            alt={data.organization.name}
            className="h-9 w-9 rounded-lg object-contain"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="size-5" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold leading-tight">{data.organization.name}</p>
          <p className="text-xs text-muted-foreground">Shipment tracking</p>
        </div>
      </div>
      <ShipmentStatusBadge status={data.shipment.status} />
    </header>
  );
}

function EtaSection({ data }: { data: PortalData }) {
  const eta = data.eta;
  if (!eta) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarClock className="size-4" /> Estimated arrival
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No live ETA yet — attach a route and active assignment for this shipment.
          </p>
        </CardContent>
      </Card>
    );
  }
  const etaDate = eta.etaAt ? new Date(eta.etaAt) : null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarClock className="size-4" /> Estimated arrival
        </CardTitle>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            eta.isDelayed
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {eta.isDelayed ? "Delayed" : "On time"}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Arriving in</p>
            <p className="mt-0.5 text-lg font-semibold">
              {eta.minutes != null ? formatEtaDuration(eta.minutes) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Predicted arrival</p>
            <p className="mt-0.5 text-lg font-semibold">
              {etaDate
                ? `${etaDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${etaDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Remaining distance</p>
            <p className="mt-0.5 text-lg font-semibold">
              {eta.remainingKm != null ? `${eta.remainingKm.toLocaleString()} km` : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ShareCard({ url, qrDataUrl }: { url: string; qrDataUrl?: string | null }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Tracking link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }, [url]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Link2 className="size-4" /> Share this shipment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`QR code for ${url}`}
            className="mx-auto aspect-square size-36 rounded-lg border bg-white p-1.5"
          />
        )}
        <p className="break-all rounded-lg border bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
          {url}
        </p>
        <Button variant="outline" size="sm" onClick={copy} className="w-full">
          {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy tracking link"}
        </Button>
      </CardContent>
    </Card>
  );
}

type PortalTrackingViewProps = {
  initial: PortalData;
  shareUrl: string;
  qrDataUrl?: string | null;
};

/**
 * Public tracking view. Renders the server-fetched snapshot and then polls the
 * (rate-limited) portal API every 30s so the position, status and ETA stay live
 * without any authentication.
 */
export function PortalTrackingView({
  initial,
  shareUrl,
  qrDataUrl,
}: PortalTrackingViewProps) {
  const [data, setData] = useState<PortalData>(initial);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const trackingNumber = data.shipment.trackingNumber;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(trackingNumber)}`);
      if (!res.ok) return;
      const next = (await res.json()) as PortalData;
      setData(next);
      setLastUpdated(new Date());
    } catch {
      // keep last good snapshot
    }
  }, [trackingNumber]);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const vehiclePosition = useMemo(() => {
    if (data.position.lat === null || data.position.lng === null) return null;
    return { lat: data.position.lat, lng: data.position.lng };
  }, [data.position]);

  const { shipment, route } = data;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <BrandHeader data={data} />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold sm:text-xl">{shipment.trackingNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Shipment for {shipment.customerName} · {getCargoTypeLabel(shipment.cargoType)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
        </section>

        {/* Origin → Destination */}
        <Card>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <MapPin className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pickup
                </p>
                <p className="mt-0.5 text-sm font-medium">{shipment.originAddress}</p>
                {shipment.originCity && (
                  <p className="text-xs text-muted-foreground">{shipment.originCity}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                <Truck className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Drop-off
                </p>
                <p className="mt-0.5 text-sm font-medium">{shipment.destinationAddress}</p>
                {shipment.destinationCity && (
                  <p className="text-xs text-muted-foreground">{shipment.destinationCity}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <PortalTrackingMap
              waypoints={route?.waypoints ?? []}
              geometry={route?.geometry ?? null}
              vehiclePosition={vehiclePosition}
            />

            <EtaSection data={data} />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Shipment details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {getShipmentStatusLabel(shipment.status)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cargo</p>
                  <p className="mt-0.5 text-sm font-medium">{getCargoTypeLabel(shipment.cargoType)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="mt-0.5 text-sm">{shipment.cargoDescription ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="mt-0.5 text-sm">{fmtDate(shipment.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estimated delivery</p>
                  <p className="mt-0.5 text-sm">{fmtDate(shipment.estimatedDeliverAt)}</p>
                </div>
                {shipment.actualDeliveredAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Delivered</p>
                    <p className="mt-0.5 text-sm">{fmtDate(shipment.actualDeliveredAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <ShareCard url={shareUrl} qrDataUrl={qrDataUrl} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Box className="size-4" /> Cargo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Truck className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vehicle</p>
                    <p className="text-sm font-medium">
                      {data.vehicle ? data.vehicle.plateNumber : "Not assigned"}
                    </p>
                    {data.vehicle && (
                      <p className="text-xs text-muted-foreground">
                        {data.vehicle.make} {data.vehicle.model}
                      </p>
                    )}
                  </div>
                </div>
                {data.driver && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Driver</p>
                      <p className="text-sm font-medium">{data.driver.name}</p>
                    </div>
                  </div>
                )}
                {data.position.recordedAt && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <ArrowRight className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last update</p>
                      <p className="text-sm font-medium">{fmtDate(data.position.recordedAt)}</p>
                      {data.position.speedKmh != null && (
                        <p className="text-xs text-muted-foreground">
                          {Math.round(data.position.speedKmh)} km/h
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-right text-xs text-muted-foreground">
              Updated {fmtDate(lastUpdated)}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Shipment timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrackingTimeline events={data.events} />
          </CardContent>
        </Card>
      </main>

      <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        Powered by CargoFlow — {data.organization.name}
      </footer>
    </div>
  );
}