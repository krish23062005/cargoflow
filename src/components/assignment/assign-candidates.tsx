"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, User, Truck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverStatusBadge } from "@/components/shared/driver-status-badge";
import { VehicleStatusBadge } from "@/components/shared/vehicle-status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props =
  | { kind: "vehicle"; entityId: string; open: boolean; onOpenChange: (v: boolean) => void }
  | { kind: "driver"; entityId: string; open: boolean; onOpenChange: (v: boolean) => void };

export function AssignCandidates(props: Props) {
  const utils = api.useUtils();
  const assignMutation = api.assignment.assign.useMutation();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const isVehicle = props.kind === "vehicle";

  const listQuery = isVehicle
    ? api.driver.list.useQuery(
        { page: 1, pageSize: 50, search: debounced || null, status: "AVAILABLE", licenseStatus: null },
        { enabled: props.open },
      )
    : api.fleet.list.useQuery(
        { page: 1, pageSize: 50, search: debounced || null, status: "AVAILABLE", type: null },
        { enabled: props.open },
      );

  const candidates =
    (listQuery.data?.items as { id: string; name?: string; phone?: string; status?: string }[]) ?? [];

  async function assign(targetId: string) {
    setBusyId(targetId);
    try {
      const payload =
        props.kind === "vehicle"
          ? { vehicleId: props.entityId, driverId: targetId }
          : { vehicleId: targetId, driverId: props.entityId };
      const assigned = await assignMutation.mutateAsync(payload);
      setBusyId(null);
      if (!assigned) return;
      toast.success("Assigned successfully");
      props.onOpenChange(false);
      void utils.assignment.getActiveForVehicle.invalidate();
      void utils.assignment.getActiveForDriver.invalidate();
      void utils.fleet.summary.invalidate();
      void utils.driver.summary.invalidate();
      void utils.fleet.get.invalidate();
      void utils.driver.get.invalidate();
      void utils.driver.list.invalidate();
      void utils.fleet.list.invalidate();
    } catch {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isVehicle ? "Assign a driver" : "Assign a vehicle"}
          </DialogTitle>
          <DialogDescription>
            {isVehicle
              ? "Choose an available driver for this vehicle."
              : "Choose an available vehicle for this driver."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isVehicle ? "Search drivers…" : "Search vehicles…"}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {listQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {isVehicle
                ? "No available drivers. Everyone is either assigned, on trip, off duty or suspended."
                : "No available vehicles. All are in use, in transit or in maintenance."}
            </p>
          ) : (
            candidates.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  {isVehicle ? (
                    <User className="size-4 text-muted-foreground" />
                  ) : (
                    <Truck className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {isVehicle
                      ? c.name
                      : `${"make" in c ? `${(c as { make?: string }).make ?? ""} ${"model" in c ? (c as { model?: string }).model ?? "" : ""}` : ""}`.trim()}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {isVehicle ? c.phone : (c as { plateNumber?: string }).plateNumber}
                  </p>
                </div>
                {isVehicle ? (
                  <DriverStatusBadge status={c.status ?? "AVAILABLE"} />
                ) : (
                  <VehicleStatusBadge status={c.status ?? "AVAILABLE"} />
                )}
                <Button size="sm" disabled={busyId === c.id} onClick={() => assign(c.id)}>
                  {busyId === c.id && <Loader2 className="animate-spin" />}
                  Assign
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}