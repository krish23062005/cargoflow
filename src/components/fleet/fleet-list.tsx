"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Search, Truck } from "lucide-react";
import { api } from "@/trpc/client";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleStatusBadge } from "@/components/shared/vehicle-status-badge";
import {
  VEHICLE_TYPES_META,
  VEHICLE_STATUS_META,
  getVehicleTypeLabel,
} from "@/lib/constants/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type VehicleRow = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  type: string;
  status: string;
  color: string | null;
};

export function FleetList({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [debounced, setDebounced] = useState("");

  const listQuery = api.fleet.list.useQuery(
    {
      page,
      search: debounced || null,
      type: type === "ALL" ? null : type,
      status: status === "ALL" ? null : status,
    },
  );

  const result = listQuery.data;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebounced(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const columns: Column<VehicleRow>[] = [
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Truck className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.plateNumber}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.make} {row.model} · {row.year}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => getVehicleTypeLabel(row.type),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <VehicleStatusBadge status={row.status} />,
    },
    {
      key: "details",
      header: "Details",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {[row.color].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {result?.total ?? 0} vehicle{result?.total === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button asChild>
            <Link href="/fleet/new">
              <Plus /> Add vehicle
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
            placeholder="Search by plate, make, model, VIN…"
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {VEHICLE_TYPES_META.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {VEHICLE_STATUS_META.map((s) => (
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
        onRowClick={(row) => router.push(`/fleet/${row.id}`)}
        emptyState={
          <EmptyState
            icon={Truck}
            title="No vehicles found"
            description={
              canManage
                ? "Add your first vehicle to start building your fleet."
                : "No vehicles match your search."
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link href="/fleet/new">
                    <Plus /> Add vehicle
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
