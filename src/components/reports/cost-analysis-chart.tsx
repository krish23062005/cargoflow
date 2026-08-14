"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { Wallet } from "lucide-react";
import { CHART_COLORS } from "@/components/reports/chart-colors";

export type CostAnalysisData = {
  placeholder: boolean;
  totalCost: number;
  rows: {
    vehicleId: string;
    plateNumber: string;
    make: string;
    model: string;
    distanceKm: number;
    fuelCost: number;
    maintenanceCost: number;
    totalCost: number;
  }[];
};

export function CostAnalysisView({ data }: { data: CostAnalysisData }) {
  if (data.rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Wallet}
            title="No cost data"
            description="Vehicles with completed trips in this window will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.rows.slice(0, 12).map((r) => ({
    name: r.plateNumber,
    Fuel: r.fuelCost,
    Maintenance: r.maintenanceCost,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost per vehicle</CardTitle>
        <CardDescription>
          {data.placeholder
            ? "Estimated fuel and maintenance from trip distance (placeholder until finance data is wired in)."
            : "Fuel and maintenance costs in the selected window."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Total cost</p>
            <p className="text-2xl font-bold tracking-tight">${data.totalCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fuel share</p>
            <p className="text-2xl font-bold tracking-tight text-sky-600">
              ${data.rows.reduce((a, r) => a + r.fuelCost, 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Maintenance share</p>
            <p className="text-2xl font-bold tracking-tight text-violet-600">
              ${data.rows.reduce((a, r) => a + r.maintenanceCost, 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                formatter={(value) => [
                  typeof value === "number" ? `$${value.toFixed(2)}` : String(value),
                ]}
              />
              <Legend />
              <Bar dataKey="Fuel" stackId="cost" fill={CHART_COLORS.sky} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Maintenance" stackId="cost" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Vehicle</th>
                <th className="py-2 pr-4 font-medium">Distance</th>
                <th className="py-2 pr-4 font-medium">Fuel</th>
                <th className="py-2 pr-4 font-medium">Maintenance</th>
                <th className="py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.rows.map((r) => (
                <tr key={r.vehicleId}>
                  <td className="py-2 pr-4 font-medium">
                    {r.plateNumber}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {r.make} {r.model}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{r.distanceKm.toLocaleString()} km</td>
                  <td className="py-2 pr-4">${r.fuelCost.toFixed(2)}</td>
                  <td className="py-2 pr-4">${r.maintenanceCost.toFixed(2)}</td>
                  <td className="py-2 font-medium">${r.totalCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}