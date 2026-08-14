"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "INVITE",
  "JOIN",
  "ROLE_CHANGE",
  "REMOVE_MEMBER",
  "LOGIN",
];

const RESOURCES = [
  "organization",
  "member",
  "fleet",
  "driver",
  "shipment",
  "route",
  "tracking",
  "notification",
];

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  UPDATE: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  INVITE: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  JOIN: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  ROLE_CHANGE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  REMOVE_MEMBER: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  LOGIN: "bg-muted text-muted-foreground",
};

export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>("all");
  const [resource, setResource] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching } = api.audit.list.useQuery({
    page,
    pageSize: 20,
    action: action === "all" ? null : action,
    resource: resource === "all" ? null : resource,
    search: debouncedSearch || null,
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or id…"
            className="pl-9"
          />
        </div>
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a.replace(/_/g, " ").toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resource} onValueChange={(v) => { setResource(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            {RESOURCES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <ShieldCheck className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No activity found</p>
            <p className="text-sm text-muted-foreground">
              {isFetching ? "Loading…" : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead className="hidden sm:table-cell">Details</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-7">
                        <AvatarImage src={entry.user.image ?? undefined} alt={entry.user.name} />
                        <AvatarFallback>
                          {entry.user.name?.slice(0, 2).toUpperCase() ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{entry.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ACTION_STYLES[entry.action]}>
                      {entry.action.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{entry.resource}</TableCell>
                  <TableCell className="hidden max-w-64 truncate text-xs text-muted-foreground sm:table-cell">
                    {entry.resourceId ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {data ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}` : "—"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span className="w-16 text-center">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
