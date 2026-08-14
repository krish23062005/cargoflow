"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FileText,
  Info,
  Lock,
} from "lucide-react";
import { api } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { FleetUtilizationChart } from "@/components/reports/fleet-utilization-chart";
import { DeliveryPerformanceView } from "@/components/reports/delivery-performance";
import { DriverScorecardView } from "@/components/reports/driver-scorecard";
import { CostAnalysisView } from "@/components/reports/cost-analysis-chart";
import { ShipmentSummaryView } from "@/components/reports/shipment-summary-chart";
import { toCsv, downloadCsv } from "@/lib/utils/csv-export";

export type ReportType =
  | "fleet"
  | "delivery"
  | "scorecard"
  | "cost"
  | "shipments";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "fleet", label: "Fleet utilization" },
  { value: "delivery", label: "Delivery performance" },
  { value: "scorecard", label: "Driver scorecard" },
  { value: "cost", label: "Cost analysis" },
  { value: "shipments", label: "Shipment summary" },
];

function isoDate(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  return isoDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

function today(): string {
  return isoDate(new Date());
}

export function ReportsPage({ canView }: { canView: boolean }) {
  const [type, setType] = useState<ReportType>("shipments");
  const [from, setFrom] = useState<string>(() => daysAgo(30));
  const [to, setTo] = useState<string>(() => today());

  const payload = useMemo(() => {
    if (!from || !to) return undefined;
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59.999`);
    return fromDate <= toDate ? { from: fromDate, to: toDate } : undefined;
  }, [from, to]);

  const fleet = api.report.fleetUtilization.useQuery(payload ?? {}, {
    enabled: Boolean(canView && payload && type === "fleet"),
  });
  const delivery = api.report.deliveryPerformance.useQuery(payload ?? {}, {
    enabled: Boolean(canView && payload && type === "delivery"),
  });
  const scorecard = api.report.driverScorecard.useQuery(payload ?? {}, {
    enabled: Boolean(canView && payload && type === "scorecard"),
  });
  const cost = api.report.costAnalysis.useQuery(payload ?? {}, {
    enabled: Boolean(canView && payload && type === "cost"),
  });
  const shipments = api.report.shipmentSummary.useQuery(payload ?? {}, {
    enabled: Boolean(canView && payload && type === "shipments"),
  });

  if (!canView) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Lock}
              title="Reports are restricted"
              description="Ask an owner, admin or dispatcher to grant you report access."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const active = {
    fleet: { data: fleet.data, isLoading: fleet.isLoading },
    delivery: { data: delivery.data, isLoading: delivery.isLoading },
    scorecard: { data: scorecard.data, isLoading: scorecard.isLoading },
    cost: { data: cost.data, isLoading: cost.isLoading },
    shipments: { data: shipments.data, isLoading: shipments.isLoading },
  }[type];

  const exportRows = (): Record<string, unknown>[] => {
    switch (type) {
      case "fleet":
        return (fleet.data ?? []).map((r) => ({
          vehicle: `${r.plateNumber} · ${r.make} ${r.model}`,
          status: r.status,
          trips: r.trips,
          activeDays: r.activeDays,
          utilization_pct: r.utilizationPct,
        }));
      case "delivery": {
        const d = delivery.data;
        if (!d) return [];
        return d.byDriver.map((r) => ({
          driver: r.driverName,
          delivered: r.delivered,
          on_time: r.onTime,
          late: r.late,
          on_time_pct: r.onTimePct,
          avg_delay_min: r.avgDelayMinutes,
        }));
      }
      case "scorecard":
        return (scorecard.data ?? []).map((r) => ({
          driver: r.name,
          trips: r.trips,
          on_time_pct: r.onTimePct,
          distance_km: r.distanceKm,
        }));
      case "cost": {
        const c = cost.data;
        if (!c) return [];
        return c.rows.map((r) => ({
          vehicle: `${r.plateNumber} · ${r.make} ${r.model}`,
          distance_km: r.distanceKm,
          fuel_cost_usd: r.fuelCost,
          maintenance_cost_usd: r.maintenanceCost,
          total_cost_usd: r.totalCost,
        }));
      }
      case "shipments": {
        const s = shipments.data;
        if (!s) return [];
        return s.byStatus.map((r) => ({
          status: r.status,
          count: r.count,
        }));
      }
    }
  };

  const handleExport = () => {
    const csv = toCsv(exportRows());
    if (csv) {
      downloadCsv(`cargoflow-${type}-${from}-${to}.csv`, csv);
    }
  };

  const loading = active.isLoading;
  const empty = (active.data as { total?: number } | unknown[] | null | undefined) == null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Utilization, delivery performance and cost insights for {from} → {to}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || empty}>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="PDF export runs via a Trigger.dev background job (deferred)"
          >
            <FileText className="mr-2 size-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
          <SelectTrigger className="w-full sm:w-60">
            <SelectValue placeholder="Report type" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-1">
          {[
            { label: "7d", days: 7 },
            { label: "30d", days: 30 },
            { label: "90d", days: 90 },
          ].map((p) => (
            <Button
              key={p.days}
              size="sm"
              variant="ghost"
              onClick={() => {
                setFrom(daysAgo(p.days));
                setTo(today());
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {!payload ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Info}
              title="Invalid date range"
              description="Pick a start date that is before the end date."
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {type === "fleet" && <FleetUtilizationChart data={fleet.data ?? []} />}
          {type === "delivery" && delivery.data && <DeliveryPerformanceView data={delivery.data} />}
          {type === "scorecard" && <DriverScorecardView data={scorecard.data ?? []} />}
          {type === "cost" && cost.data && <CostAnalysisView data={cost.data} />}
          {type === "shipments" && shipments.data && <ShipmentSummaryView data={shipments.data} />}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="size-4 text-muted-foreground" />
            About this report
          </CardTitle>
          <CardDescription>
            CSV exports are generated in the browser. PDF export and scheduled
            delivery run through a Trigger.dev background job, and product
            analytics through PostHog — both deferred integrations.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}