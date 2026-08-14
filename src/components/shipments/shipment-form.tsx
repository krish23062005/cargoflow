"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/trpc/client";
import {
  createShipmentSchema,
  type CreateShipmentInput,
  type UpdateShipmentInput,
} from "@/lib/validators/shipment";
import { CARGO_TYPE_META } from "@/lib/constants/shipments";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ShipmentMapPicker = dynamic(
  () =>
    import("@/components/shipments/shipment-map-picker").then(
      (m) => m.ShipmentMapPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[260px] animate-pulse items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

type ShipmentFormInput = z.input<typeof createShipmentSchema>;

type ShipmentRecord = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  originAddress: string;
  originCity: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationAddress: string;
  destinationCity: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  cargoType: string;
  cargoDescription: string | null;
  weightKg: number | null;
  dimensions: string | null;
  declaredValue: number | null;
  requestedPickupAt: Date | string | null;
  estimatedDeliverAt: Date | string | null;
  notes: string | null;
  routeId: string | null;
};

const toInput = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().split("T")[0] : "";

export function ShipmentForm({
  shipment,
  onDone,
}: {
  shipment?: ShipmentRecord;
  onDone?: () => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const createMutation = api.shipment.create.useMutation();
  const updateMutation = api.shipment.update.useMutation();
  const routesQuery = api.route.list.useQuery({ pageSize: 100, page: 1 });
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(shipment);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShipmentFormInput, unknown, CreateShipmentInput>({
    resolver: zodResolver(createShipmentSchema),
    defaultValues: shipment
      ? {
          customerName: shipment.customerName,
          customerPhone: shipment.customerPhone ?? "",
          customerEmail: shipment.customerEmail ?? "",
          originAddress: shipment.originAddress,
          originCity: shipment.originCity ?? "",
          originLat: shipment.originLat ?? undefined,
          originLng: shipment.originLng ?? undefined,
          destinationAddress: shipment.destinationAddress,
          destinationCity: shipment.destinationCity ?? "",
          destinationLat: shipment.destinationLat ?? undefined,
          destinationLng: shipment.destinationLng ?? undefined,
          cargoType: shipment.cargoType as CreateShipmentInput["cargoType"],
          cargoDescription: shipment.cargoDescription ?? "",
          weightKg: shipment.weightKg ?? undefined,
          dimensions: shipment.dimensions ?? "",
          declaredValue: shipment.declaredValue ?? undefined,
          requestedPickupAt: shipment.requestedPickupAt
            ? new Date(shipment.requestedPickupAt)
            : undefined,
          estimatedDeliverAt: shipment.estimatedDeliverAt
            ? new Date(shipment.estimatedDeliverAt)
            : undefined,
          notes: shipment.notes ?? "",
          routeId: shipment.routeId ?? undefined,
        }
      : {
          customerName: "",
          customerPhone: "",
          customerEmail: "",
          originAddress: "",
          originCity: "",
          originLat: undefined,
          originLng: undefined,
          destinationAddress: "",
          destinationCity: "",
          destinationLat: undefined,
          destinationLng: undefined,
          cargoType: "GENERAL",
          cargoDescription: "",
          weightKg: undefined,
          dimensions: "",
          declaredValue: undefined,
          requestedPickupAt: undefined,
          estimatedDeliverAt: undefined,
          notes: "",
          routeId: undefined,
        },
  });

  async function onSubmit(values: CreateShipmentInput) {
    setSubmitting(true);
    if (isEdit && shipment) {
      const payload: UpdateShipmentInput = { id: shipment.id, ...values };
      const updated = await updateMutation.mutateAsync(payload);
      setSubmitting(false);
      if (!updated) return;
      toast.success("Shipment updated");
      void utils.shipment.get.invalidate();
      void utils.shipment.list.invalidate();
      void utils.shipment.summary.invalidate();
      onDone?.();
      return;
    }

    const created = await createMutation.mutateAsync(values);
    setSubmitting(false);

    if (!created) return;

    toast.success(`Shipment ${created.trackingNumber} created`);
    void utils.shipment.list.invalidate();
    void utils.shipment.summary.invalidate();
    router.push(`/shipments/${created.id}`);
  }

  const field = (name: string) =>
    errors[name as keyof CreateShipmentInput]?.message as string | undefined;

  const originLat = watch("originLat");
  const originLng = watch("originLng");
  const destinationLat = watch("destinationLat");
  const destinationLng = watch("destinationLng");
  const selectedRouteId = watch("routeId");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer name *</Label>
            <Input id="customerName" placeholder="Hauwa Traders Ltd" {...register("customerName")} />
            {field("customerName") && (
              <p className="text-xs text-destructive">{field("customerName")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Customer phone</Label>
            <Input
              id="customerPhone"
              placeholder="+2348012345678"
              inputMode="tel"
              {...register("customerPhone")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customerEmail">Customer email</Label>
            <Input
              id="customerEmail"
              type="email"
              placeholder="dispatch@hauwa.com"
              {...register("customerEmail")}
            />
            {field("customerEmail") && (
              <p className="text-xs text-destructive">{field("customerEmail")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="originAddress">Origin address *</Label>
              <Input id="originAddress" placeholder="Apapa Port, Lagos" {...register("originAddress")} />
              {field("originAddress") && (
                <p className="text-xs text-destructive">{field("originAddress")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="originCity">Origin city</Label>
              <Input id="originCity" placeholder="Lagos" {...register("originCity")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationAddress">Destination address *</Label>
              <Input
                id="destinationAddress"
                placeholder="Trade Fair Complex, Accra"
                {...register("destinationAddress")}
              />
              {field("destinationAddress") && (
                <p className="text-xs text-destructive">{field("destinationAddress")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationCity">Destination city</Label>
              <Input id="destinationCity" placeholder="Accra" {...register("destinationCity")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPinned className="size-3.5" /> Pin location on map
            </Label>
            <ShipmentMapPicker
              origin={originLat != null && originLng != null ? { lat: originLat, lng: originLng } : null}
              destination={
                destinationLat != null && destinationLng != null
                  ? { lat: destinationLat, lng: destinationLng }
                  : null
              }
              onPick={(field, lat, lng) => {
                if (field === "origin") {
                  setValue("originLat", lat);
                  setValue("originLng", lng);
                } else {
                  setValue("destinationLat", lat);
                  setValue("destinationLng", lng);
                }
              }}
              onClear={(field) => {
                if (field === "origin") {
                  setValue("originLat", undefined);
                  setValue("originLng", undefined);
                } else {
                  setValue("destinationLat", undefined);
                  setValue("destinationLng", undefined);
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routeTemplate">Route template</Label>
            <Select
              value={selectedRouteId ?? ""}
              onValueChange={(v) => setValue("routeId", v || undefined)}
            >
              <SelectTrigger id="routeTemplate" className="w-full">
                <SelectValue placeholder="No route template (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem key="none" value="">
                  No route template
                </SelectItem>
                {(routesQuery.data?.items ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optional: link a saved route template from /routes. Each route can only serve one shipment.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cargo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cargoType">Cargo type</Label>
            <Select
              defaultValue="GENERAL"
              value={shipment ? shipment.cargoType : undefined}
              onValueChange={(v) => setValue("cargoType", v as CreateShipmentInput["cargoType"])}
            >
              <SelectTrigger id="cargoType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARGO_TYPE_META.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="weightKg">Weight (kg)</Label>
            <Input
              id="weightKg"
              type="number"
              step="0.1"
              placeholder="4500"
              {...register("weightKg", { valueAsNumber: true })}
            />
            {field("weightKg") && <p className="text-xs text-destructive">{field("weightKg")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="declaredValue">Declared value</Label>
            <Input
              id="declaredValue"
              type="number"
              step="0.01"
              placeholder="1250000"
              {...register("declaredValue", { valueAsNumber: true })}
            />
            {field("declaredValue") && (
              <p className="text-xs text-destructive">{field("declaredValue")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dimensions">Dimensions</Label>
            <Input id="dimensions" placeholder="120x80x60 cm" {...register("dimensions")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cargoDescription">Cargo description</Label>
            <Input
              id="cargoDescription"
              placeholder="Packed textiles, 40 bags of rice, wooden crates…"
              {...register("cargoDescription")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="requestedPickupAt">Requested pickup</Label>
            <Input
              id="requestedPickupAt"
              type="date"
              defaultValue={toInput(shipment?.requestedPickupAt)}
              onChange={(e) =>
                setValue("requestedPickupAt", e.target.value ? new Date(e.target.value) : undefined)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedDeliverAt">Estimated delivery</Label>
            <Input
              id="estimatedDeliverAt"
              type="date"
              defaultValue={toInput(shipment?.estimatedDeliverAt)}
              onChange={(e) =>
                setValue("estimatedDeliverAt", e.target.value ? new Date(e.target.value) : undefined)
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" placeholder="Special handling or instructions…" {...register("notes")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (onDone) {
              onDone();
            } else {
              router.back();
            }
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {isEdit ? "Save changes" : "Create shipment"}
        </Button>
      </div>
    </form>
  );
}