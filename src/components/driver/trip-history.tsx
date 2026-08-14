"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CalendarClock, RefreshCw, Truck } from "lucide-react";
import type { DriverTrip } from "@/server/driver";
import { getShipmentStatusLabel } from "@/lib/constants/shipments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShipmentStatusBadge } from "@/components/shared/shipment-status-badge";
import { cn } from "@/lib/utils";

const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Current",
  ENDED: "Ended",
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function TripHistory() {
  const router = useRouter();
  const [trips, setTrips] = useState<DriverTrip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/driver/trips");
      if (res.status === 401) {
        router.replace("/driver/login");
        return;
      }
      if (!res.ok) {
        setError("Could not load your trips.");
        return;
      }
      const data = (await res.json()) as { trips: DriverTrip[] };
      setTrips(data.trips);
    } catch {
      setError("Network error. Pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/driver/trips");
        if (res.status === 401) {
          router.replace("/driver/login");
          return;
        }
        if (!res.ok) {
          if (alive) setError("Could not load your trips.");
          return;
        }
        const data = (await res.json()) as { trips: DriverTrip[] };
        if (alive) setTrips(data.trips);
      } catch {
        if (alive) setError("Network error. Pull to refresh.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 size-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!trips || trips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Box className="size-10 text-muted-foreground" />
        <p className="text-sm font-medium">No trips yet</p>
        <p className="text-xs text-muted-foreground">
          Your assignments and deliveries will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{trips.length} trip(s)</p>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 size-4" />
          Refresh
        </Button>
      </div>

      {trips.map((t) => {
        const vehicleLabel = t.vehicle
          ? t.vehicle.plateNumber || `${t.vehicle.make} ${t.vehicle.model}`.trim()
          : "No vehicle";
        return (
        <Card key={t.assignmentId} className={cn(t.assignmentStatus === "ACTIVE" && "border-primary/40")}>
          <CardContent className="grid gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Truck className="size-4 text-muted-foreground" />
                {vehicleLabel}
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  t.assignmentStatus === "ACTIVE" &&
                    "bg-primary/10 text-primary",
                )}
              >
                {ASSIGNMENT_STATUS_LABEL[t.assignmentStatus] ?? t.assignmentStatus}
              </Badge>
            </div>

            {t.shipment ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm">
                    <Box className="size-3.5 text-muted-foreground" />
                    {t.shipment.trackingNumber}
                  </p>
                  <ShipmentStatusBadge status={t.shipment.status} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {t.shipment.customerName} · {getShipmentStatusLabel(t.shipment.status)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.shipment.originAddress} → {t.shipment.destinationAddress}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No shipment carried on this assignment.</p>
            )}

            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarClock className="size-3.5" />
              {fmtDate(t.startDate)}
              {t.endDate ? ` → ${fmtDate(t.endDate)}` : " → ongoing"}
              {t.shipment?.actualDeliveredAt
                ? ` · delivered ${fmtDate(t.shipment.actualDeliveredAt)}`
                : ""}
            </p>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}