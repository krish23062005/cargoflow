"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
import { CheckCircle2, Clock } from "lucide-react";
import { CHART_COLORS } from "@/components/reports/chart-colors";

export type DeliveryStat = {
  delivered: number;
  withEstimate: number;
  onTime: number;
  late: number;
  onTimePct: number;
  avgDelayMinutes: number;
};

export type DeliveryPerformanceData = {
  overall: DeliveryStat;
  byDriver: (DeliveryStat & { driverName: string })[];
  byRoute: (DeliveryStat & { routeName: string })[];
};

export function DeliveryPerformanceView({ data }: { data: DeliveryPerformanceData }) {
  const { overall } = data;

  if (overall.delivered === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={CheckCircle2}
            title="No deliveries in this window"
            description="Shipments marked delivered in this date range will be scored here."
          />
        </CardContent>
      </Card>
    );
  }

  const donut = [
    { name: "On time", value: overall.onTime, color: CHART_COLORS.emerald },
    { name: "Late", value: overall.late, color: CHART_COLORS.red },
  ];

  const driverChart = data.byDriver.slice(0, 10).map((d) => ({
    name: d.driverName,
    "On time %": d.onTimePct,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">On-time rate</CardTitle>
            <CardDescription>Delivered within the estimated delivery window.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{overall.onTimePct}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {overall.onTime} of {overall.withEstimate} deliveries with an ETA{overall.late > 0 ? ` · ${overall.late} late` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Average delay</CardTitle>
            <CardDescription>Mean lateness for deliveries past their ETA.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{overall.avgDelayMinutes} min</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {overall.late} late delivery
              {overall.late === 1 ? "" : "ies"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delivery outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {donut.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">On-time % by driver</CardTitle>
            <CardDescription>Top 10 drivers by delivery volume.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driverChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} angle={-18} height={46} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, "On time"]} />
                  <Bar dataKey="On time %" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Delivery performance by driver</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {data.byDriver.map((d) => (
            <div key={d.driverName} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.driverName}</p>
                <p className="text-xs text-muted-foreground">
                  {d.delivered} delivered · {d.onTime} on time
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={d.onTimePct >= 90 ? "default" : d.onTimePct >= 70 ? "secondary" : "destructive"}>
                  {d.onTimePct}% on-time
                </Badge>
                {d.late > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {d.avgDelayMinutes}m avg delay
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}