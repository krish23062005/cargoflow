"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import { Truck, Radio, Wifi, WifiOff, Loader2, AlertTriangle, X } from "lucide-react";
import { api } from "@/trpc/client";
import { useSSE } from "@/hooks/use-sse";
import type { VehicleLive } from "@/server/tracking";
import type { EtaLive } from "@/server/eta";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LiveMap = dynamic(
  () => import("@/components/tracking/live-map").then((m) => m.LiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full animate-pulse items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

const STATUS_OPTIONS = [
  { value: "", label: "All vehicles" },
  { value: "AVAILABLE", label: "Available" },
  { value: "IN_USE", label: "In use" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "DECOMMISSIONED", label: "Decommissioned" },
];

/** Named SSE events this view subscribes to (stable identity for the hook). */
const SSE_EVENTS = ["positions", "eta", "eta_delayed"];

/** A shipment the system thinks is running behind its promised delivery. */
type DelayedShipment = {
  shipmentId: string;
  trackingNumber: string;
  etaAt: string | null;
  delayMin: number | null;
};

export function TrackingView() {
  const { data: initial, isLoading } = api.tracking.live.useQuery({});
  const [statusFilter, setStatusFilter] = useState("");

  // Only SSE push-updates mutate state; the initial tRPC snapshot is merged in
  // the memo below so `initial` stays the stable base layer.
  const [pushed, setPushed] = useState<VehicleLive[]>([]);
  const [delayed, setDelayed] = useState<Map<string, DelayedShipment>>(new Map());

  const onEvent = useCallback((event: string, data: Record<string, unknown>) => {
    if (event === "positions" && Array.isArray(data.vehicles)) {
      setPushed(data.vehicles as VehicleLive[]);
      return;
    }
    if (event === "eta" || event === "eta_delayed") {
      // The broadcast `eta` payload is EtaLive; `eta_delayed` is a subset of
      // the same shape. Track which shipments are currently behind schedule.
      setDelayed((prev) => {
        const live = data as Partial<EtaLive> & { shipmentId: string; trackingNumber: string };
        if (!live.shipmentId) return prev;
        const next = new Map(prev);
        if (event === "eta_delayed" || live.isDelayed) {
          next.set(live.shipmentId, {
            shipmentId: live.shipmentId,
            trackingNumber: live.trackingNumber,
            etaAt: live.etaAt ?? null,
            delayMin: live.delayMin ?? null,
          });
        } else {
          next.delete(live.shipmentId);
        }
        return next;
      });
    }
  }, []);

  const { status, reconnect } = useSSE({
    url: "/api/sse/tracking",
    onEvent,
    events: SSE_EVENTS,
  });

  // Merge the stable tRPC snapshot with pushed SSE updates (SSE wins).
  const vehicles = useMemo(() => {
    const map = new Map((initial ?? []).map((v) => [v.vehicleId, v]));
    for (const v of pushed) map.set(v.vehicleId, v);
    return Array.from(map.values());
  }, [initial, pushed]);

  const positioned = vehicles.filter((v) => v.lat !== null && v.lng !== null);

  const stats = useMemo(() => {
    const withPosition = positioned;
    let moving = 0;
    for (const v of withPosition) {
      if ((v.speedKmh ?? 0) > 1) moving += 1;
    }
    return {
      total: vehicles.length,
      live: withPosition.length,
      moving,
    };
  }, [vehicles, positioned]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[560px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Truck className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-none">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Vehicles</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <Radio className="size-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-none">{stats.live}</p>
            <p className="text-xs text-muted-foreground">Reporting position</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Truck className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-none">{stats.moving}</p>
            <p className="text-xs text-muted-foreground">Moving now</p>
          </div>
        </div>
      </div>

      {delayed.size > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" />
              {delayed.size === 1 ? "1 shipment " : `${delayed.size} shipments `}
              are behind schedule
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setDelayed(new Map())}
              aria-label="Dismiss delayed alerts"
            >
              <X className="size-4" />
            </Button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Array.from(delayed.values()).map((d) => (
              <li key={d.shipmentId}>
                <Link
                  href={`/shipments/${d.shipmentId}`}
                  className="rounded-md border border-amber-500/40 bg-background px-2.5 py-1 font-mono text-xs text-amber-700 hover:underline dark:text-amber-400"
                >
                  #{d.trackingNumber}
                  {d.delayMin ? ` · ${d.delayMin} min late` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All vehicles" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {status === "open" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
              <Wifi className="size-3.5" /> Live
            </span>
          ) : status === "connecting" ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Connecting…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
              <WifiOff className="size-3.5" /> Reconnecting…
            </span>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={reconnect}>
          Reconnect
        </Button>
      </div>

      <div className="h-[560px]">
        <LiveMap vehicles={vehicles} statusFilter={statusFilter || null} />
      </div>

      {!isLoading && vehicles.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No vehicles to track yet — add vehicles to the fleet first.
        </p>
      )}
    </div>
  );
}