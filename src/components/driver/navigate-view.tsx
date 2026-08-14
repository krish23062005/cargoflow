"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, MapPin, Navigation, Route as RouteIcon } from "lucide-react";
import type { DriverContext } from "@/server/driver";
import type { Waypoint } from "@/lib/validators/route";
import { haversineKm } from "@/lib/utils/eta-calculator";
import { getWaypointTypeMeta, getWaypointTypeLabel } from "@/lib/constants/routes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShipmentStatusBadge } from "@/components/shared/shipment-status-badge";
import { DriverMap } from "@/components/driver/driver-map";
import { Etag } from "@/components/driver/eta";
import { useDriverTracking } from "@/components/driver/use-driver-tracking";
import { cn } from "@/lib/utils";

const POLL_MS = 15000;

function findNextWaypoint(
  waypoints: Waypoint[],
  vehicle: { lat: number; lng: number } | null,
): { waypoint: Waypoint; index: number; distanceKm: number } | null {
  if (waypoints.length === 0) return null;
  if (!vehicle) return { waypoint: waypoints[0], index: 0, distanceKm: 0 };

  let closestIdx = 0;
  let closest = Infinity;
  waypoints.forEach((w, i) => {
    const d = haversineKm(vehicle.lat, vehicle.lng, w.lat, w.lng);
    if (d < closest) {
      closest = d;
      closestIdx = i;
    }
  });
  // Haven't reached the closest one yet → it's next; otherwise push forward.
  const target =
    closestIdx < waypoints.length - 1 ? Math.max(closestIdx + 1, closestIdx) : closestIdx;

  return {
    waypoint: waypoints[target],
    index: target,
    distanceKm: haversineKm(vehicle.lat, vehicle.lng, waypoints[target].lat, waypoints[target].lng),
  };
}

export function NavigationView({ initial }: { initial: DriverContext }) {
  const router = useRouter();
  const [ctx, setCtx] = useState<DriverContext>(initial);
  const vehicleId = ctx.assignment?.vehicleId;
  const { liveCoord } = useDriverTracking(vehicleId);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/driver/context");
        if (res.status === 401) {
          router.replace("/driver/login");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as DriverContext;
        if (alive) setCtx(data);
      } catch {
        /* keep last known context */
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router]);

  const shipment = ctx.shipment;
  const waypoints = useMemo(() => ctx.route?.waypoints ?? [], [ctx.route?.waypoints]);
  const vehicle = useMemo(
    () =>
      liveCoord ??
      (ctx.position?.lat != null && ctx.position.lng != null
        ? { lat: ctx.position.lat, lng: ctx.position.lng }
        : null),
    [liveCoord, ctx.position],
  );

  const next = useMemo(
    () => findNextWaypoint(waypoints, vehicle),
    [waypoints, vehicle],
  );

  if (!shipment) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <RouteIcon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No trip to navigate</p>
        <p className="text-xs text-muted-foreground">
          Once a shipment is assigned to you, your route and next stop appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Navigation className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{shipment.trackingNumber}</p>
              <p className="text-xs text-muted-foreground">
                {shipment.originAddress} → {shipment.destinationAddress}
              </p>
            </div>
          </div>
          <ShipmentStatusBadge status={shipment.status} />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 p-4 pb-8">
        <DriverMap
          waypoints={waypoints}
          geometry={ctx.route?.geometry}
          vehicle={vehicle}
          labels={{ origin: shipment.originAddress, destination: shipment.destinationAddress }}
          className="h-[42vh]"
        />

        {next ? (
          <Card>
            <CardContent className="grid gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next stop
                </p>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1"
                  style={{ color: getWaypointTypeMeta(next.waypoint.type).color }}
                >
                  <MapPin className="size-3" />
                  {getWaypointTypeLabel(next.waypoint.type)}
                </Badge>
              </div>
              <p className="truncate text-base font-semibold">
                {next.waypoint.name ?? `Stop ${next.index + 1} of ${waypoints.length}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {vehicle
                  ? next.distanceKm < 1
                    ? "≈ arriving now"
                    : `${next.distanceKm.toFixed(1)} km away`
                  : `Stop ${next.index + 1} of ${waypoints.length}`}
              </p>
              <Etag eta={ctx.eta} status={shipment.status} />
            </CardContent>
          </Card>
        ) : null}

        {waypoints.length > 0 ? (
          <Card>
            <CardContent className="grid gap-1 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Flag className="size-3.5" />
                Stops on this route
              </p>
              {waypoints.map((w, i) => {
                const meta = getWaypointTypeMeta(w.type);
                const isNext = next?.index === i;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5",
                      isNext && "bg-primary/10",
                    )}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span className="flex-1 truncate text-sm">
                      {i + 1}. {w.name ?? meta.label}
                    </span>
                    {isNext ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Next
                      </Badge>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}