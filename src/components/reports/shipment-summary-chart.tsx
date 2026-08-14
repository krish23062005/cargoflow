"use client";

import {
  Area,
  AreaChart,
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
import { EmptyState } from "@/components/shared/empty-state";
import { Package } from "lucide-react";
import { CHART_COLORS } from "@/components/reports/chart-colors";
import { getShipmentStatusLabel } from "@/lib/constants/shipments";

export type ShipmentSummaryData = {
  total: number;
  periodBucket: string;
  byStatus: { status: string; count: number; color: string }[];
  byCustomer: { customerName: string; count: number }[];
  byCargoType: { cargoType: string; count: number }[];
  byPeriod: { date: string; count: number }[];
};

export function ShipmentSummaryView({ data }: { data: ShipmentSummaryData }) {
  if (data.total === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Package}
            title="No shipments in this window"
            description="Shipments created in this date range will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  const statusPie = data.byStatus.map((s) => ({
    name: getShipmentStatusLabel(s.status),
    value: s.count,
    color: s.color,
  }));

  const customerBars = data.byCustomer.map((c) => ({
    name: c.customerName.length > 16 ? `${c.customerName.slice(0, 15)}…` : c.customerName,
    shipments: c.count,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Volume by status</CardTitle>
          <CardDescription>{data.total} shipments created in this window.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusPie.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Volume over time</CardTitle>
            <CardDescription>Shipments per {data.periodBucket} bucket.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.byPeriod} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.sky} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.sky} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="Shipments" stroke={CHART_COLORS.sky} fill="url(#vol)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerBars} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={110}
                  />
                  <Tooltip />
                  <Bar dataKey="shipments" fill={CHART_COLORS.emerald} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Volume by cargo type</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.byCargoType.map((c) => (
            <span
              key={c.cargoType}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
            >
              {c.cargoType.toLowerCase()} · {c.count}
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}