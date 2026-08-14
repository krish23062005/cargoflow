"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "@/trpc/client";
import { createDriverSchema, type CreateDriverInput } from "@/lib/validators/driver";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DriverFormInput = z.input<typeof createDriverSchema>;

const DEFAULT_LICENCE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
const DEFAULT_LICENCE_EXPIRY_INPUT = DEFAULT_LICENCE_EXPIRY.toISOString().split("T")[0];

export function DriverForm() {
  const router = useRouter();
  const utils = api.useUtils();
  const createMutation = api.driver.create.useMutation();
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; pin: string; delivered: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<DriverFormInput, unknown, CreateDriverInput>({
    resolver: zodResolver(createDriverSchema),
    defaultValues: {
      status: "AVAILABLE",
      name: "",
      phone: "",
      email: "",
      licenseNumber: "",
      licenseClass: "",
      licenseExpiry: DEFAULT_LICENCE_EXPIRY,
      bloodType: undefined,
      emergencyContact: "",
      nextOfKinName: "",
      nextOfKinPhone: "",
      address: "",
      notes: "",
      pin: "",
    },
  });

  async function onSubmit(values: CreateDriverInput) {
    setSubmitting(true);
    try {
      const result = await createMutation.mutateAsync(values);
      setSubmitting(false);
      if (!result) return;

      toast.success(`${result.driver.name} added to your team`);
      void utils.driver.list.invalidate();
      void utils.driver.summary.invalidate();

      setCreated({
        id: result.driver.id,
        name: result.driver.name,
        pin: result.pin,
        delivered: result.delivered?.delivered === true,
      });
    } catch (e) {
      setSubmitting(false);
      toast.error(e instanceof Error ? e.message : "Could not add driver");
    }
  }

  const field = (name: string) =>
    errors[name as keyof CreateDriverInput]?.message as string | undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" placeholder="Amara Okafor" {...register("name")} />
            {field("name") && <p className="text-xs text-destructive">{field("name")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              placeholder="+2348012345678"
              inputMode="tel"
              {...register("phone")}
            />
            {field("phone") && <p className="text-xs text-destructive">{field("phone")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="amara@example.com" {...register("email")} />
            {field("email") && <p className="text-xs text-destructive">{field("email")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              defaultValue="AVAILABLE"
              onValueChange={(v) => setValue("status", v as CreateDriverInput["status"])}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVER_STATUS_META.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                    <span className="ml-2 text-xs text-muted-foreground">{s.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" placeholder="Ikeja, Lagos" {...register("address")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bloodType">Blood type</Label>
            <Select
              defaultValue=""
              onValueChange={(v) =>
                setValue("bloodType", (v || null) as CreateDriverInput["bloodType"])
              }
            >
              <SelectTrigger id="bloodType">
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
            <Label htmlFor="pin">Login PIN</Label>
            <Input
              id="pin"
              placeholder="Leave blank to auto-generate"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              {...register("pin")}
            />
            {field("pin") ? (
              <p className="text-xs text-destructive">{field("pin")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                4–8 digits. Leave empty and a secure PIN is generated for you.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Driver licence</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="licenseNumber">Licence number *</Label>
            <Input id="licenseNumber" placeholder="FRSC 12345678" {...register("licenseNumber")} />
            {field("licenseNumber") && (
              <p className="text-xs text-destructive">{field("licenseNumber")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="licenseClass">Licence class</Label>
            <Input id="licenseClass" placeholder="C" {...register("licenseClass")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="licenseExpiry">Licence expiry *</Label>
            <Input
              id="licenseExpiry"
              type="date"
              defaultValue={DEFAULT_LICENCE_EXPIRY_INPUT}
              onChange={(e) =>
                setValue("licenseExpiry", e.target.value ? new Date(e.target.value) : new Date())
              }
            />
            {field("licenseExpiry") && (
              <p className="text-xs text-destructive">{field("licenseExpiry")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency contact & next of kin</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emergencyContact">Emergency contact</Label>
            <Input id="emergencyContact" placeholder="Emergency number or person" {...register("emergencyContact")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextOfKinName">Next of kin</Label>
            <Input id="nextOfKinName" placeholder="Chidi Okafor" {...register("nextOfKinName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextOfKinPhone">Next of kin phone</Label>
            <Input
              id="nextOfKinPhone"
              placeholder="+2347012345678"
              inputMode="tel"
              {...register("nextOfKinPhone")}
            />
            {field("nextOfKinPhone") && (
              <p className="text-xs text-destructive">{field("nextOfKinPhone")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" placeholder="Any notes…" {...register("notes")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Add driver
        </Button>
      </div>

      <Dialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Driver added — save this PIN</DialogTitle>
            <DialogDescription>
              {created?.delivered
                ? `We emailed the login details to ${created?.name}. Keep this copy too, just in case.`
                : `Share the PIN below with ${created?.name}. We couldn't email it (no address or email not configured), so send it manually.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/50 p-6">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Login PIN
            </span>
            <span className="font-mono text-4xl font-bold tracking-[0.3em]">
              {created?.pin ?? ""}
            </span>
            <span className="text-xs text-muted-foreground">
              Phone: {created?.name ? "see driver profile" : ""}
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (created) {
                  void navigator.clipboard.writeText(created.pin);
                  toast.success("PIN copied to clipboard");
                }
              }}
            >
              Copy PIN
            </Button>
            <Button
              onClick={() => {
                if (created) router.push(`/drivers/${created.id}`);
              }}
            >
              View driver profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
