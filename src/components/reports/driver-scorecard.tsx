"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";
import { CHART_COLORS } from "@/components/reports/chart-colors";

export type DriverScorecardRow = {
  driverId: string;
  name: string;
  status: string;
  trips: number;
  onTimePct: number;
  distanceKm: number;
};

export function DriverScorecardView({ data }: { data: DriverScorecardRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Users}
            title="No completed trips"
            description="Drivers with completed deliveries in this window will be scored here."
          />
        </CardContent>
      </Card>
    );
  }

  const maxDistance = Math.max(...data.map((d) => d.distanceKm), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Driver scorecard</CardTitle>
        <CardDescription>
          Trips completed, on-time rate and distance covered in this window.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {data.map((d) => (
          <div key={d.driverId} className="flex items-center gap-4 py-3">
            <div className="w-40 min-w-0">
              <p className="truncate text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.trips} trips</p>
            </div>

            <div className="hidden w-40 sm:block">
              <p className="mb-1 text-xs text-muted-foreground">On-time {d.onTimePct}%</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${d.onTimePct}%`, backgroundColor: CHART_COLORS.emerald }}
                />
              </div>
            </div>

            <div className="hidden flex-1 md:block">
              <p className="mb-1 text-xs text-muted-foreground">
                {d.distanceKm.toLocaleString()} km covered
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(d.distanceKm / maxDistance) * 100}%`,
                    backgroundColor: CHART_COLORS.sky,
                  }}
                />
              </div>
            </div>

            <Badge
              className="ml-auto shrink-0"
              variant={d.onTimePct >= 90 ? "default" : d.onTimePct >= 70 ? "secondary" : "destructive"}
            >
              {d.onTimePct}% on-time
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}