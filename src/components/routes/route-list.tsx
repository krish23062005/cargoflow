"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Plus, Route as RouteIcon, Search } from "lucide-react";
import { api } from "@/trpc/client";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDistanceKm, formatDurationMin } from "@/lib/constants/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RouteRow = {
  id: string;
  name: string;
  notes: string | null;
  waypointCount: number;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  createdAt: Date | string;
  shipment?: { trackingNumber: string } | null;
};

export function RouteList({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const listQuery = api.route.list.useQuery({
    page,
    search: debounced || null,
  });

  const result = listQuery.data;

  const rows: RouteRow[] = (result?.items ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    notes: r.notes,
    waypointCount: Array.isArray(r.waypoints) ? (r.waypoints as unknown[]).length : 0,
    totalDistanceKm: r.totalDistanceKm,
    estimatedDurationMin: r.estimatedDurationMin,
    createdAt: r.createdAt,
    shipment: r.shipment,
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebounced(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const columns: Column<RouteRow>[] = [
    {
      key: "route",
      header: "Route",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.notes || "No notes"}</p>
        </div>
      ),
    },
    {
      key: "waypoints",
      header: "Waypoints",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <MapPin className="size-3.5 text-emerald-500" />
          {row.waypointCount}
        </span>
      ),
    },
    {
      key: "distance",
      header: "Distance",
      cell: (row) => <span className="text-sm">{formatDistanceKm(row.totalDistanceKm)}</span>,
    },
    {
      key: "duration",
      header: "Est. duration",
      cell: (row) => <span className="text-sm">{formatDurationMin(row.estimatedDurationMin)}</span>,
    },
    {
      key: "shipment",
      header: "Linked shipment",
      cell: (row) =>
        row.shipment ? (
          <span className="font-mono text-xs">{row.shipment.trackingNumber}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {result?.total ?? 0} route{result?.total === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button asChild>
            <Link href="/routes/new">
              <Plus /> New route
            </Link>
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search route name or notes…"
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        isLoading={listQuery.isLoading}
        onRowClick={(row) => router.push(`/routes/${row.id}`)}
        emptyState={
          <EmptyState
            icon={RouteIcon}
            title="No routes yet"
            description={
              canManage
                ? "Plan your first route on the map to save distances, ETAs and waypoints as a reusable template."
                : "No routes match your search."
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link href="/routes/new">
                    <Plus /> New route
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