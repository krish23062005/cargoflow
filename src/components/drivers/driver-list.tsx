"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Search, User } from "lucide-react";
import { api } from "@/trpc/client";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { DriverStatusBadge } from "@/components/shared/driver-status-badge";
import { LicenseStatusBadge } from "@/components/shared/license-status-badge";
import { DRIVER_STATUS_META } from "@/lib/constants/drivers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DriverRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  licenseNumber: string;
  licenseExpiry: Date | string;
  licenseStatus: "VALID" | "EXPIRING" | "EXPIRED";
  status: string;
};

export function DriverList({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("ALL");
  const [license, setLicense] = useState("ALL");

  const listQuery = api.driver.list.useQuery({
    page,
    search: debounced || null,
    status: status === "ALL" ? null : status,
    licenseStatus: license === "ALL" ? null : (license as "VALID" | "EXPIRING" | "EXPIRED"),
  });

  const result = listQuery.data;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebounced(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const columns: Column<DriverRow>[] = [
    {
      key: "driver",
      header: "Driver",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.phone}
              {row.email ? ` · ${row.email}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <DriverStatusBadge status={row.status} />,
    },
    {
      key: "license",
      header: "Licence",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs">{row.licenseNumber}</span>
          <LicenseStatusBadge status={row.licenseStatus} expiry={row.licenseExpiry} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {result?.total ?? 0} driver{result?.total === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button asChild>
            <Link href="/drivers/new">
              <Plus /> Add driver
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
            placeholder="Search by name, phone, licence…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {DRIVER_STATUS_META.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={license} onValueChange={setLicense}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All licences</SelectItem>
            <SelectItem value="VALID">Valid</SelectItem>
            <SelectItem value="EXPIRING">Expiring soon</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={result?.items}
        rowKey={(row) => row.id}
        isLoading={listQuery.isLoading}
        onRowClick={(row) => router.push(`/drivers/${row.id}`)}
        emptyState={
          <EmptyState
            icon={User}
            title="No drivers found"
            description={
              canManage
                ? "Add your first driver to start building your team."
                : "No drivers match your search."
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link href="/drivers/new">
                    <Plus /> Add driver
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
