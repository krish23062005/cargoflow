"use client";

import { CalendarClock, Clock, Gauge, MapPinned, Timer } from "lucide-react";
import { api } from "@/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEtaDuration } from "@/lib/utils/eta-calculator";
import { formatDurationMin } from "@/lib/constants/routes";

/**
 * Live ETA card for the shipment detail page. Shows predicted arrival, how far
 * the truck still has to go, the speed the estimate is based on, and a compact
 * trail of past predictions (predicted vs actual once delivered).
 */
export function EtaCard({ shipmentId }: { shipmentId: string }) {
  const etaQuery = api.eta.forShipment.useQuery({ shipmentId });
  const historyQuery = api.eta.history.useQuery({ shipmentId, limit: 8 });

  const eta = etaQuery.data?.eta ?? null;

  if (etaQuery.isLoading) {
    return <Skeleton className="h-44" />;
  }

  if (!eta) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarClock className="size-4" /> ETA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No ETA yet — attach a route (or vehicle) with an active assignment
            and the prediction appears here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const etaDate = eta.etaAt ? new Date(eta.etaAt) : null;
  const history = historyQuery.data ?? [];

  return (
    <Card className="sm:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarClock className="size-4" /> ETA
        </CardTitle>
        {etaDate && (
          <span className="font-mono text-lg font-semibold text-foreground">
            {etaDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
            {etaDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <Badge variant={eta.isDelayed ? "destructive" : "default"}>
          {eta.isDelayed ? "Delayed" : "On time"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="size-3.5" /> Arriving in
            </p>
            <p className="text-lg font-semibold">{formatEtaDuration(eta.minutes)}</p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPinned className="size-3.5" /> Remaining
            </p>
            <p className="text-lg font-semibold">
              {eta.remainingKm != null ? `${eta.remainingKm.toLocaleString()} km` : "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="size-3.5" /> Speed basis
            </p>
            <p className="text-lg font-semibold">
              {eta.speedUsedKmh != null ? `${eta.speedUsedKmh} km/h` : "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> Target delivery
            </p>
            <p className="text-lg font-semibold">
              {eta.delayMin != null && eta.delayMin > 0
                ? `${formatDurationMin(eta.delayMin)} late`
                : "On target"}
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Prediction trail
            </p>
            <div className="flex flex-wrap gap-2">
              {history.slice(0, 6).map((h) => {
                const off =
                  h.actualDeliveredAt && h.predictedMinutes
                    ? Math.round(
                        (h.actualDeliveredAt.getTime() -
                          h.predictedAt.getTime()) /
                          60_000 -
                          h.predictedMinutes,
                      )
                    : null;
                return (
                  <Badge key={h.id} variant="outline" className="font-mono text-[11px]">
                    {new Date(h.predictedAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {h.predictedMinutes != null ? formatEtaDuration(h.predictedMinutes) : "—"}
                    {off !== null && (
                      <span className={off <= 0 ? "text-emerald-500" : "text-amber-600"}>
                        {" · "}
                        {off <= 0 ? "early " : "late "}
                        {formatDurationMin(Math.abs(off))}
                      </span>
                    )}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}