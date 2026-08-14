"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Truck } from "lucide-react";
import { CHART_COLORS } from "@/components/reports/chart-colors";

export type FleetUtilizationRow = {
  vehicleId: string;
  plateNumber: string;
  make: string;
  model: string;
  status: string;
  trips: number;
  activeDays: number;
  rangeDays: number;
  utilizationPct: number;
};

export function FleetUtilizationChart({ data }: { data: FleetUtilizationRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Truck}
            title="No utilization data"
            description="Assignments in this date range will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.slice(0, 12).map((v) => ({
    name: v.plateNumber,
    "% active": v.utilizationPct,
    trips: v.trips,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Vehicle utilization</CardTitle>
          <CardDescription>
            Share of the selected window each vehicle was actively assigned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} unit="%" />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  formatter={(value, name) =>
                    name === "% active" ? [`${value}%`, "Utilization"] : [value as number, "Trips"]
                  }
                />
                <Bar dataKey="% active" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Utilization by vehicle</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {data.map((v) => (
            <div key={v.vehicleId} className="flex items-center gap-3 py-2">
              <span className="w-32 truncate text-sm font-medium">
                {v.plateNumber}
                <span className="block text-xs font-normal text-muted-foreground">
                  {v.make} {v.model}
                </span>
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, v.utilizationPct)}%`, backgroundColor: CHART_COLORS.violet }}
                />
              </div>
              <Badge variant={v.utilizationPct >= 70 ? "default" : "secondary"}>
                {v.utilizationPct}% · {v.trips} trips
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}