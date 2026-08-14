"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/trpc/client";
import {
  createVehicleSchema,
  type CreateVehicleInput,
} from "@/lib/validators/vehicle";

type VehicleFormInput = z.input<typeof createVehicleSchema>;
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const dateToInput = (date: Date | null | undefined) =>
  date ? new Date(date).toISOString().split("T")[0] : "";

export function VehicleForm() {
  const router = useRouter();
  const utils = api.useUtils();
  const createMutation = api.fleet.create.useMutation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VehicleFormInput, unknown, CreateVehicleInput>({
    resolver: zodResolver(createVehicleSchema),
    defaultValues: {
      type: "TRUCK",
      status: "AVAILABLE",
      color: "",
      vin: "",
      fuelType: "",
      fuelCapacity: undefined,
      insuranceCompany: "",
      insuranceExpiry: undefined,
      lastServiceAt: undefined,
      nextServiceAt: undefined,
      notes: "",
    },
  });

  async function onSubmit(values: CreateVehicleInput) {
    setSubmitting(true);
    const vehicle = await createMutation.mutateAsync(values);
    setSubmitting(false);

    if (!vehicle) return;

    toast.success(`${vehicle.plateNumber} added to your fleet`);
    void utils.fleet.list.invalidate();
    void utils.fleet.summary.invalidate();
    router.push(`/fleet/${vehicle.id}`);
  }

  const field = (name: string) =>
    errors[name as keyof CreateVehicleInput]?.message as string | undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vehicle details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="plateNumber">Plate number *</Label>
            <Input
              id="plateNumber"
              placeholder="KJA 123B"
              {...register("plateNumber")}
            />
            {field("plateNumber") && (
              <p className="text-xs text-destructive">{field("plateNumber")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              defaultValue="TRUCK"
              onValueChange={(v) => setValue("type", v as CreateVehicleInput["type"])}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES_META.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                    <span className="ml-2 text-xs text-muted-foreground">{t.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="make">Make *</Label>
            <Input id="make" placeholder="Toyota" {...register("make")} />
            {field("make") && <p className="text-xs text-destructive">{field("make")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Model *</Label>
            <Input id="model" placeholder="Hilux" {...register("model")} />
            {field("model") && <p className="text-xs text-destructive">{field("model")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Year *</Label>
            <Input
              id="year"
              type="number"
              placeholder="2022"
              {...register("year", { valueAsNumber: true })}
            />
            {field("year") && <p className="text-xs text-destructive">{field("year")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input id="color" placeholder="White" {...register("color")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vin">VIN / Chassis number</Label>
            <Input id="vin" placeholder="JT4HN46N403063857" {...register("vin")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              defaultValue="AVAILABLE"
              onValueChange={(v) => setValue("status", v as CreateVehicleInput["status"])}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_STATUS_META.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                    <span className="ml-2 text-xs text-muted-foreground">{s.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fuel & maintenance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fuelType">Fuel type</Label>
            <Select
              defaultValue=""
              onValueChange={(v) => setValue("fuelType", v || null)}
            >
              <SelectTrigger id="fuelType">
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
            <Label htmlFor="fuelCapacity">Fuel capacity (L)</Label>
            <Input
              id="fuelCapacity"
              type="number"
              step="0.1"
              placeholder="80"
              {...register("fuelCapacity", { valueAsNumber: true })}
            />
            {field("fuelCapacity") && (
              <p className="text-xs text-destructive">{field("fuelCapacity")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastServiceAt">Last service date</Label>
            <Input
              id="lastServiceAt"
              type="date"
              defaultValue={dateToInput(null)}
              onChange={(e) => setValue("lastServiceAt", e.target.value ? new Date(e.target.value) : null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextServiceAt">Next service due</Label>
            <Input
              id="nextServiceAt"
              type="date"
              defaultValue={dateToInput(null)}
              onChange={(e) => setValue("nextServiceAt", e.target.value ? new Date(e.target.value) : null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="insuranceCompany">Insurance provider</Label>
            <Input
              id="insuranceCompany"
              placeholder="Cornerstone Insurance"
              {...register("insuranceCompany")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="insuranceExpiry">Insurance expires</Label>
            <Input
              id="insuranceExpiry"
              type="date"
              defaultValue={dateToInput(null)}
              onChange={(e) => setValue("insuranceExpiry", e.target.value ? new Date(e.target.value) : null)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            rows={3}
            placeholder="Optional notes about this vehicle…"
            {...register("notes")}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Add vehicle
        </Button>
      </div>
    </form>
  );
}
