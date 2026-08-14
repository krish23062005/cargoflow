"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Package, Plus, Search } from "lucide-react";
import { api } from "@/trpc/client";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ShipmentStatusBadge } from "@/components/shared/shipment-status-badge";
import { SHIPMENT_STATUS_META } from "@/lib/constants/shipments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ShipmentRow = {
  id: string;
  trackingNumber: string;
  status: string;
  customerName: string;
  originAddress: string;
  destinationAddress: string;
  cargoType: string;
  weightKg: number | null;
  createdAt: Date | string;
  assignment?: {
    vehicle?: { plateNumber: string; make: string; model: string } | null;
    driver?: { name: string } | null;
  } | null;
};

export function ShipmentList({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("ALL");

  const listQuery = api.shipment.list.useQuery({
    page,
    search: debounced || null,
    status: status === "ALL" ? null : status,
  });

  const result = listQuery.data;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebounced(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const columns: Column<ShipmentRow>[] = [
    {
      key: "tracking",
      header: "Tracking",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-medium">{row.trackingNumber}</p>
          <p className="truncate text-xs text-muted-foreground">{row.customerName}</p>
        </div>
      ),
    },
    {
      key: "route",
      header: "Route",
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0 text-emerald-500" />
          <span className="min-w-0 max-w-36 truncate">{row.originAddress}</span>
          <span className="shrink-0">→</span>
          <span className="min-w-0 max-w-36 truncate">{row.destinationAddress}</span>
        </div>
      ),
    },
    {
      key: "assigned",
      header: "Assigned to",
      cell: (row) =>
        row.assignment ? (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">
              {row.assignment.driver?.name ?? "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.assignment.vehicle
                ? `${row.assignment.vehicle.make} ${row.assignment.vehicle.model} (${row.assignment.vehicle.plateNumber})`
                : ""}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { key: "status", header: "Status", cell: (row) => <ShipmentStatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {result?.total ?? 0} shipment{result?.total === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button asChild>
            <Link href="/shipments/new">
              <Plus /> New shipment
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracking, customer, address…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {SHIPMENT_STATUS_META.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={result?.items}
        rowKey={(row) => row.id}
        isLoading={listQuery.isLoading}
        onRowClick={(row) => router.push(`/shipments/${row.id}`)}
        emptyState={
          <EmptyState
            icon={Package}
            title="No shipments found"
            description={
              canManage
                ? "Create your first shipment to generate a tracking number."
                : "No shipments match your search."
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link href="/shipments/new">
                    <Plus /> New shipment
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {(result.page - 1) * result.pageSize + 1}–
            {Math.min(result.page * result.pageSize, result.total)} of {result.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1 || listQuery.isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="w-16 text-center">
              {page} / {result.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= result.totalPages || listQuery.isLoading}
              onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}