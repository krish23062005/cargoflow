"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Calendar,
  Fuel,
  Info,
  Loader2,
  Pencil,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/trpc/client";
import { VehicleStatusBadge } from "@/components/shared/vehicle-status-badge";
import {
  getVehicleTypeLabel,
  VEHICLE_STATUS_META,
  type VehicleStatus,
} from "@/lib/constants/vehicles";
import { VehicleEditDialog } from "@/components/fleet/vehicle-edit-dialog";
import { AssignmentPanel } from "@/components/assignment/assignment-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString() : "—";

export function VehicleDetail({ vehicleId, canManage }: { vehicleId: string; canManage: boolean }) {
  const router = useRouter();
  const utils = api.useUtils();
  const vehicleQuery = api.fleet.get.useQuery({ id: vehicleId });
  const updateMutation = api.fleet.update.useMutation();
  const archiveMutation = api.fleet.archive.useMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const vehicle = vehicleQuery.data;

  if (vehicleQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/fleet" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to fleet
        </Link>
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Vehicle not found.
        </div>
      </div>
    );
  }

  const current = vehicle;

  async function changeStatus(status: VehicleStatus) {
    setStatusBusy(true);
    await updateMutation.mutateAsync({ id: current.id, status });
    setStatusBusy(false);
    toast.success("Status updated");
    void utils.fleet.list.invalidate();
    void utils.fleet.summary.invalidate();
  }

  async function archive() {
    setArchiving(true);
    await archiveMutation.mutateAsync({ id: current.id });
    setArchiving(false);
    setArchiveOpen(false);
    toast.success(`${current.plateNumber} archived`);
    void utils.fleet.list.invalidate();
    void utils.fleet.summary.invalidate();
    router.push("/fleet");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/fleet"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to fleet
        </Link>
        {canManage && (
          <div className="flex items-center gap-2">
            {vehicle.status !== "DECOMMISSIONED" && (
              <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                <Archive /> Archive
              </Button>
            )}
            <Button onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10">
            <Truck className="size-7 text-primary" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{vehicle.plateNumber}</h1>
              <VehicleStatusBadge status={vehicle.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {vehicle.make} {vehicle.model} · {vehicle.year} ·{" "}
              {getVehicleTypeLabel(vehicle.type)}
            </p>
          </div>
        </div>
        {canManage && vehicle.status !== "DECOMMISSIONED" && (
          <Select value={vehicle.status} onValueChange={changeStatus} disabled={statusBusy}>
            <SelectTrigger className="w-44">
              {statusBusy ? <Loader2 className="size-3.5 animate-spin" /> : <SelectValue />}
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_STATUS_META.filter((s) => s.value !== "DECOMMISSIONED").map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vehicle details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Color" value={vehicle.color || "—"} />
            <DetailItem label="VIN" value={vehicle.vin || "—"} />
            <DetailItem label="Created" value={fmt(vehicle.createdAt)} />
            <DetailItem label="Last updated" value={fmt(vehicle.updatedAt)} />
          </CardContent>
        </Card>

        <AssignmentPanel kind="vehicle" vehicleId={vehicle.id} canManage={canManage} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Fuel className="size-4" /> Fuel
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Fuel type" value={vehicle.fuelType || "—"} />
            <DetailItem
              label="Capacity"
              value={vehicle.fuelCapacity ? `${vehicle.fuelCapacity} L` : "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="size-4" /> Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Last service" value={fmt(vehicle.lastServiceAt)} />
            <DetailItem label="Next service" value={fmt(vehicle.nextServiceAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="size-4" /> Insurance
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Provider" value={vehicle.insuranceCompany || "—"} />
            <DetailItem label="Expires" value={fmt(vehicle.insuranceExpiry)} />
          </CardContent>
        </Card>
      </div>

      {vehicle.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Info className="size-4" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{vehicle.notes}</p>
          </CardContent>
        </Card>
      )}

      {vehicle.status === "DECOMMISSIONED" && (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          This vehicle has been archived and is no longer available for assignment.
        </Badge>
      )}

      <VehicleEditDialog
        vehicle={vehicle}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive {vehicle.plateNumber}?</DialogTitle>
            <DialogDescription>
              The vehicle will be marked as decommissioned and hidden from active
              assignments. This can be reversed later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archive} disabled={archiving}>
              {archiving && <Loader2 className="animate-spin" />}
              Archive vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
