"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Box,
  Calendar,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Route,
  Truck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/trpc/client";
import { ShipmentStatusBadge } from "@/components/shared/shipment-status-badge";
import { StatusTimeline } from "@/components/shipments/status-timeline";
import { ShipmentForm } from "@/components/shipments/shipment-form";
import { PodCard } from "@/components/shipments/pod-card";
import { EtaCard } from "@/components/shared/eta-card";
import {
  getCargoTypeLabel,
  getNextShipmentStatuses,
  SHIPMENT_STATUS_META,
  type ShipmentStatus,
} from "@/lib/constants/shipments";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

export function ShipmentDetail({
  shipmentId,
  canManage,
  canUpdateStatus,
}: {
  shipmentId: string;
  canManage: boolean;
  canUpdateStatus: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const shipmentQuery = api.shipment.get.useQuery({ id: shipmentId });
  const statusMutation = api.shipment.updateStatus.useMutation();
  const assignMutation = api.shipment.assign.useMutation();
  const eventMutation = api.shipment.addEvent.useMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<ShipmentStatus | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [eventDesc, setEventDesc] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [busy, setBusy] = useState(false);

  const activeAssignments = api.assignment.list.useQuery(
    { status: "ACTIVE", pageSize: 50 },
    { enabled: assignOpen && canManage },
  );

  const shipment = shipmentQuery.data;

  if (shipmentQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/shipments" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to shipments
        </Link>
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Shipment not found.
        </div>
      </div>
    );
  }

  const current = shipment;

  const nextStatuses = getNextShipmentStatuses(current.status);

  function invalidateAll() {
    void utils.shipment.get.invalidate();
    void utils.shipment.list.invalidate();
    void utils.shipment.summary.invalidate();
  }

  async function changeStatus() {
    if (!statusTarget) return;
    setBusy(true);
    await statusMutation.mutateAsync({ id: current.id, status: statusTarget });
    setBusy(false);
    setStatusTarget(null);
    toast.success(`Shipment is now ${statusTarget}`);
    invalidateAll();
    router.refresh();
  }

  async function assign() {
    if (!assignmentId) return;
    setBusy(true);
    await assignMutation.mutateAsync({ id: current.id, assignmentId });
    setBusy(false);
    setAssignOpen(false);
    setAssignmentId("");
    toast.success("Shipment assigned");
    invalidateAll();
  }

  async function logEvent() {
    if (eventDesc.trim().length < 2) return;
    setBusy(true);
    await eventMutation.mutateAsync({
      id: current.id,
      eventType: "NOTE",
      description: eventDesc.trim(),
      location: eventLocation.trim() || null,
    });
    setBusy(false);
    setEventOpen(false);
    setEventDesc("");
    setEventLocation("");
    toast.success("Event logged");
    invalidateAll();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/shipments"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to shipments
        </Link>
        {canManage && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10">
            <Box className="size-7 text-primary" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">
                {shipment.trackingNumber}
              </h1>
              <ShipmentStatusBadge status={shipment.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {shipment.customerName}
              {shipment.customerPhone ? ` · ${shipment.customerPhone}` : ""}
            </p>
          </div>
        </div>

        {canUpdateStatus && nextStatuses.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={statusTarget ?? undefined}
              onValueChange={(v) => setStatusTarget(v as ShipmentStatus)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {nextStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SHIPMENT_STATUS_META.find((m) => m.value === s)?.label ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={changeStatus} disabled={!statusTarget || busy}>
              {busy && <Loader2 className="animate-spin" />}
              Update
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EtaCard shipmentId={shipment.id} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                <MapPin className="size-4" /> Route
              </span>
              {shipment.route && canManage && (
                <Link
                  href={`/routes/${shipment.route.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Route className="size-3" /> View route
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailItem label="Origin" value={shipment.originAddress} />
            {shipment.originCity && (
              <DetailItem label="Origin city" value={shipment.originCity} />
            )}
            <DetailItem label="Destination" value={shipment.destinationAddress} />
            {shipment.destinationCity && (
              <DetailItem label="Destination city" value={shipment.destinationCity} />
            )}
            {shipment.route && (
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Route template
                </p>
                <Link
                  href={`/routes/${shipment.route.id}`}
                  className="mt-1 block text-sm font-medium hover:underline"
                >
                  {shipment.route.name}
                </Link>
                {shipment.route.totalDistanceKm != null && (
                  <p className="text-xs text-muted-foreground">
                    {shipment.route.totalDistanceKm.toLocaleString()} km
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Box className="size-4" /> Cargo
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Type" value={getCargoTypeLabel(shipment.cargoType)} />
            <DetailItem
              label="Weight"
              value={shipment.weightKg ? `${shipment.weightKg.toLocaleString()} kg` : "—"}
            />
            <DetailItem
              label="Declared value"
              value={shipment.declaredValue ? shipment.declaredValue.toLocaleString() : "—"}
            />
            <DetailItem label="Dimensions" value={shipment.dimensions || "—"} />
            {shipment.cargoDescription && (
              <div className="sm:col-span-2">
                <DetailItem label="Description" value={shipment.cargoDescription} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="size-4" /> Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Requested pickup" value={fmt(shipment.requestedPickupAt)} />
            <DetailItem label="Estimated delivery" value={fmt(shipment.estimatedDeliverAt)} />
            <DetailItem label="Created" value={fmt(shipment.createdAt)} />
            <DetailItem label="Delivered" value={fmt(shipment.actualDeliveredAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Route className="size-4" /> Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shipment.assignment ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{shipment.assignment.driver.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Truck className="size-3" />
                      {shipment.assignment.vehicle.make} {shipment.assignment.vehicle.model} (
                      {shipment.assignment.vehicle.plateNumber})
                    </p>
                  </div>
                </div>
                <ShipmentStatusBadge status={shipment.assignment.vehicle.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No vehicle–driver assignment linked to this shipment.
              </p>
            )}

            {canManage && (
              <>
                <Button
                  className="mt-4"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignOpen(true)}
                  disabled={assignOpen}
                >
                  {shipment.assignment ? "Reassign" : "Assign vehicle & driver"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Links the shipment to an active vehicle–driver assignment.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Phone className="size-4" /> Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Name" value={shipment.customerName} />
            <DetailItem label="Phone" value={shipment.customerPhone || "—"} />
            <div className="sm:col-span-2">
              <DetailItem label="Email" value={shipment.customerEmail || "—"} />
            </div>
          </CardContent>
        </Card>

        <PodCard shipmentId={shipment.id} />

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                <Route className="size-4" /> Timeline
              </span>
              {canUpdateStatus && (
                <Button variant="outline" size="sm" onClick={() => setEventOpen(true)}>
                  <Plus /> Log event
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline events={shipment.events} />
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit shipment</DialogTitle>
              <DialogDescription>
                Update {shipment.trackingNumber} details. Status is managed from the header.
              </DialogDescription>
            </DialogHeader>
            <ShipmentForm shipment={shipment} onDone={() => setEditOpen(false)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign vehicle & driver</DialogTitle>
            <DialogDescription>
              Choose an active assignment to fulfil this shipment.
            </DialogDescription>
          </DialogHeader>
          {activeAssignments.isLoading ? (
            <Skeleton className="h-12" />
          ) : activeAssignments.data?.items?.length ? (
            <Select value={assignmentId} onValueChange={setAssignmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an assignment" />
              </SelectTrigger>
              <SelectContent>
                {activeAssignments.data.items.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.driver.name} — {a.vehicle.make} {a.vehicle.model} ({a.vehicle.plateNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No active assignments. Assign a driver to a vehicle first.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={assign} disabled={!assignmentId || busy}>
              {busy && <Loader2 className="animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log an event</DialogTitle>
            <DialogDescription>
              Record a checkpoint, incident or note for this shipment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="eventDesc" className="text-sm font-medium">
                Description *
              </label>
              <Textarea
                id="eventDesc"
                placeholder="Reached the Jibowu checkpoint…"
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="eventLocation" className="text-sm font-medium">
                Location
              </label>
              <input
                id="eventLocation"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Jibowu, Lagos"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={logEvent} disabled={eventDesc.trim().length < 2 || busy}>
              {busy && <Loader2 className="animate-spin" />}
              Log event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}