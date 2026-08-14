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
import { updateDriverSchema, type UpdateDriverInput } from "@/lib/validators/driver";
import { DRIVER_STATUS_META, BLOOD_TYPES } from "@/lib/constants/drivers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Driver = inferRouterOutputs<AppRouter>["driver"]["get"];

type DriverEditInput = z.input<typeof updateDriverSchema>;

const dateToInput = (date: Date | string | null | undefined) =>
  date ? new Date(date).toISOString().split("T")[0] : "";

export function DriverEditDialog({
  driver,
  open,
  onOpenChange,
}: {
  driver: Driver;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const updateMutation = api.driver.update.useMutation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DriverEditInput, unknown, UpdateDriverInput>({
    resolver: zodResolver(updateDriverSchema),
    defaultValues: { id: driver.id },
  });

  useEffect(() => {
    if (open) {
      reset({
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email ?? "",
        licenseNumber: driver.licenseNumber,
        licenseClass: driver.licenseClass ?? "",
        licenseExpiry: driver.licenseExpiry,
        status: driver.status as UpdateDriverInput["status"],
        bloodType: (driver.bloodType as UpdateDriverInput["bloodType"]) ?? null,
        emergencyContact: driver.emergencyContact ?? "",
        nextOfKinName: driver.nextOfKinName ?? "",
        nextOfKinPhone: driver.nextOfKinPhone ?? "",
        address: driver.address ?? "",
        notes: driver.notes ?? "",
        pin: "",
      });
    }
  }, [open, driver, reset]);

  async function onSubmit(values: UpdateDriverInput) {
    setSubmitting(true);
    const updated = await updateMutation.mutateAsync(values);
    setSubmitting(false);
    if (!updated) return;

    toast.success("Driver updated");
    onOpenChange(false);
    void utils.driver.get.invalidate({ id: driver.id });
    void utils.driver.list.invalidate();
  }

  const field = (name: string) =>
    errors[name as keyof UpdateDriverInput]?.message as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {driver.name}</DialogTitle>
          <DialogDescription>Update this driver&apos;s details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full name *</Label>
              <Input id="edit-name" {...register("name")} />
              {field("name") && <p className="text-xs text-destructive">{field("name")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone *</Label>
              <Input id="edit-phone" {...register("phone")} />
              {field("phone") && <p className="text-xs text-destructive">{field("phone")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" {...register("email")} />
              {field("email") && <p className="text-xs text-destructive">{field("email")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={driver.status}
                onValueChange={(v) => setValue("status", v as UpdateDriverInput["status"])}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRIVER_STATUS_META.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-licenseNumber">Licence number *</Label>
              <Input id="edit-licenseNumber" {...register("licenseNumber")} />
              {field("licenseNumber") && (
                <p className="text-xs text-destructive">{field("licenseNumber")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-licenseClass">Licence class</Label>
              <Input id="edit-licenseClass" {...register("licenseClass")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-licenseExpiry">Licence expiry *</Label>
              <Input
                id="edit-licenseExpiry"
                type="date"
                defaultValue={dateToInput(driver.licenseExpiry)}
                onChange={(e) =>
                  setValue("licenseExpiry", e.target.value ? new Date(e.target.value) : new Date())
                }
              />
              {field("licenseExpiry") && (
                <p className="text-xs text-destructive">{field("licenseExpiry")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bloodType">Blood type</Label>
              <Select
                value={driver.bloodType ?? ""}
                onValueChange={(v) =>
                setValue("bloodType", (v || null) as UpdateDriverInput["bloodType"])
              }
              >
                <SelectTrigger id="edit-bloodType">
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-emergencyContact">Emergency contact</Label>
              <Input id="edit-emergencyContact" {...register("emergencyContact")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nextOfKinName">Next of kin</Label>
              <Input id="edit-nextOfKinName" {...register("nextOfKinName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nextOfKinPhone">Next of kin phone</Label>
              <Input id="edit-nextOfKinPhone" {...register("nextOfKinPhone")} />
              {field("nextOfKinPhone") && (
                <p className="text-xs text-destructive">{field("nextOfKinPhone")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input id="edit-address" {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input id="edit-notes" {...register("notes")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-pin">Reset login PIN</Label>
              <Input
                id="edit-pin"
                placeholder="Leave blank to keep current PIN"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                {...register("pin")}
              />
              {field("pin") ? (
                <p className="text-xs text-destructive">{field("pin")}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  4–8 digits. Only filled in when you want to change the driver&apos;s PIN.
                </p>
              )}
            </div>
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
