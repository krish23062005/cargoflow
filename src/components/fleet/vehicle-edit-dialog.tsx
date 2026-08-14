"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers";
import {
  updateVehicleSchema,
  type UpdateVehicleInput,
} from "@/lib/validators/vehicle";
import {
  VEHICLE_TYPES_META,
  VEHICLE_STATUS_META,
  FUEL_TYPE_META,
} from "@/lib/constants/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Vehicle = inferRouterOutputs<AppRouter>["fleet"]["get"];

type VehicleEditInput = z.input<typeof updateVehicleSchema>;

const dateToInput = (date: Date | string | null | undefined) =>
  date ? new Date(date).toISOString().split("T")[0] : "";

export function VehicleEditDialog({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const updateMutation = api.fleet.update.useMutation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<VehicleEditInput, unknown, UpdateVehicleInput>({
    resolver: zodResolver(updateVehicleSchema),
    defaultValues: { id: vehicle.id },
  });

  useEffect(() => {
    if (open) {
      reset({
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        type: vehicle.type as UpdateVehicleInput["type"],
        status: vehicle.status as UpdateVehicleInput["status"],
        color: vehicle.color ?? "",
        vin: vehicle.vin ?? "",
        fuelType: vehicle.fuelType ?? "",
        fuelCapacity: vehicle.fuelCapacity ?? undefined,
        insuranceCompany: vehicle.insuranceCompany ?? "",
        insuranceExpiry: vehicle.insuranceExpiry ?? undefined,
        lastServiceAt: vehicle.lastServiceAt ?? undefined,
        nextServiceAt: vehicle.nextServiceAt ?? undefined,
        notes: vehicle.notes ?? "",
      });
    }
  }, [open, vehicle, reset]);

  async function onSubmit(values: UpdateVehicleInput) {
    setSubmitting(true);
    const updated = await updateMutation.mutateAsync(values);
    setSubmitting(false);
    if (!updated) return;

    toast.success("Vehicle updated");
    onOpenChange(false);
    void utils.fleet.get.invalidate({ id: vehicle.id });
    void utils.fleet.list.invalidate();
  }

  const field = (name: string) =>
    errors[name as keyof UpdateVehicleInput]?.message as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {vehicle.plateNumber}</DialogTitle>
          <DialogDescription>Update this vehicle&apos;s details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-plateNumber">Plate number *</Label>
              <Input id="edit-plateNumber" {...register("plateNumber")} />
              {field("plateNumber") && (
                <p className="text-xs text-destructive">{field("plateNumber")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type</Label>
              <Select
                value={vehicle.type}
                onValueChange={(v) => setValue("type", v as UpdateVehicleInput["type"])}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES_META.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-make">Make *</Label>
              <Input id="edit-make" {...register("make")} />
              {field("make") && <p className="text-xs text-destructive">{field("make")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-model">Model *</Label>
              <Input id="edit-model" {...register("model")} />
              {field("model") && <p className="text-xs text-destructive">{field("model")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-year">Year *</Label>
              <Input
                id="edit-year"
                type="number"
                {...register("year", { valueAsNumber: true })}
              />
              {field("year") && <p className="text-xs text-destructive">{field("year")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={vehicle.status}
                onValueChange={(v) => setValue("status", v as UpdateVehicleInput["status"])}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUS_META.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Color</Label>
              <Input id="edit-color" {...register("color")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vin">VIN</Label>
              <Input id="edit-vin" {...register("vin")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fuelType">Fuel type</Label>
              <Select
                value={vehicle.fuelType ?? ""}
                onValueChange={(v) => setValue("fuelType", v || null)}
              >
                <SelectTrigger id="edit-fuelType">
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPE_META.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fuelCapacity">Fuel capacity (L)</Label>
              <Input
                id="edit-fuelCapacity"
                type="number"
                step="0.1"
                {...register("fuelCapacity", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-insuranceCompany">Insurance provider</Label>
              <Input id="edit-insuranceCompany" {...register("insuranceCompany")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-insuranceExpiry">Insurance expires</Label>
              <Input
                id="edit-insuranceExpiry"
                type="date"
                defaultValue={dateToInput(vehicle.insuranceExpiry)}
                onChange={(e) =>
                  setValue("insuranceExpiry", e.target.value ? new Date(e.target.value) : null)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastServiceAt">Last service date</Label>
              <Input
                id="edit-lastServiceAt"
                type="date"
                defaultValue={dateToInput(vehicle.lastServiceAt)}
                onChange={(e) =>
                  setValue("lastServiceAt", e.target.value ? new Date(e.target.value) : null)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nextServiceAt">Next service due</Label>
              <Input
                id="edit-nextServiceAt"
                type="date"
                defaultValue={dateToInput(vehicle.nextServiceAt)}
                onChange={(e) =>
                  setValue("nextServiceAt", e.target.value ? new Date(e.target.value) : null)
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" rows={3} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
