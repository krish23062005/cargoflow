"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { updateOrgSchema, type UpdateOrgInput } from "@/lib/validators/organization";
import { COUNTRIES, CURRENCIES, getTimezones } from "@/lib/constants/countries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    country?: string | null;
    currency?: string | null;
    timezone?: string | null;
    industry?: string | null;
  };
  role: string;
};

export function OrganizationSettingsForm({ organization, role }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const isOwner = role === "owner";

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<UpdateOrgInput>({
    resolver: zodResolver(updateOrgSchema),
    defaultValues: {
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo ?? undefined,
      country: organization.country ?? "",
      currency: organization.currency ?? "",
      timezone: organization.timezone ?? "",
      industry: organization.industry ?? "",
    },
  });

  function onCountryChange(code: string) {
    setValue("country", code, { shouldValidate: true, shouldDirty: true });
    const selected = COUNTRIES.find((c) => c.code === code);
    if (selected) {
      setValue("currency", selected.currency, { shouldDirty: true });
      setValue("timezone", selected.timezone, { shouldDirty: true });
    }
  }

  async function onSubmit(values: UpdateOrgInput) {
    setSaving(true);
    const { error } = await authClient.organization.update({
      organizationId: organization.id,
      data: {
        ...values,
        industry: values.industry ?? undefined,
      },
    });
    setSaving(false);

    if (error) {
      toast.error(error.message ?? "Failed to save changes");
      return;
    }

    toast.success("Organization updated");
    router.refresh();
  }

  async function deleteOrganization() {
    setDeleting(true);
    const { error } = await authClient.organization.delete({
      organizationId: organization.id,
    });
    setDeleting(false);

    if (error) {
      toast.error(error.message ?? "Unable to delete organization");
      return;
    }

    toast.success("Organization deleted");
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Basic information about your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" {...register("name")} />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="slug">Workspace slug</Label>
                <Input id="slug" {...register("slug")} />
                {errors.slug ? (
                  <p className="text-sm text-destructive">{errors.slug.message}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input id="logo" placeholder="https://…" {...register("logo")} />
                {errors.logo ? (
                  <p className="text-sm text-destructive">{errors.logo.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Country</Label>
              <Controller
                control={control}
                name="country"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={onCountryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.country ? (
                <p className="text-sm text-destructive">{errors.country.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} · {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.currency ? (
                  <p className="text-sm text-destructive">{errors.currency.message}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>Timezone</Label>
                <Controller
                  control={control}
                  name="timezone"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {getTimezones().map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.timezone ? (
                  <p className="text-sm text-destructive">{errors.timezone.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Industry</Label>
              <Controller
                control={control}
                name="industry"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Freight & Logistics", "E-commerce", "Agriculture", "Construction", "Manufacturing", "Oil & Gas", "Mining", "Retail", "Other"].map(
                        (i) => (
                          <SelectItem key={i} value={i}>
                            {i}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={saving || !isDirty}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Permanently delete this organization and all of its data. This cannot be
            undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={!isOwner}>
                {isOwner ? "Delete organization" : "Only the owner can delete this organization"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {organization.name}?</DialogTitle>
                <DialogDescription>
                  This will permanently remove the organization, its members, vehicles,
                  shipments and tracking history.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={deleteOrganization} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete organization"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
