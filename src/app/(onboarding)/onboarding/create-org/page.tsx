"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { createOrgSchema, type CreateOrgInput } from "@/lib/validators/organization";
import { COUNTRIES, CURRENCIES, getTimezones } from "@/lib/constants/countries";
import { slugify } from "@/lib/utils/slug";
import { Logo } from "@/components/brand/logo";
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

const INDUSTRIES = [
  "Freight & Logistics",
  "E-commerce",
  "Agriculture",
  "Construction",
  "Manufacturing",
  "Oil & Gas",
  "Mining",
  "Pharmaceuticals",
  "Food & Beverage",
  "Retail",
  "Other",
];

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      slug: "",
      country: "",
      currency: "",
      timezone: "",
      industry: "",
    },
  });

  const countryCode = watch("country");

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode),
    [countryCode],
  );

  // Auto-generate the slug from the org name.
  const name = watch("name") ?? "";
  useEffect(() => {
    if (name) {
      setValue("slug", slugify(name), { shouldValidate: true });
    }
  }, [name, setValue]);

  // Auto-fill currency + timezone when a country is selected.
  useEffect(() => {
    if (country) {
      setValue("currency", country.currency, { shouldValidate: true });
      setValue("timezone", country.timezone, { shouldValidate: true });
    }
  }, [country, setValue]);

  async function onSubmit(values: CreateOrgInput) {
    setLoading(true);
    const { data, error } = await authClient.organization.create({
      name: values.name,
      slug: values.slug ?? slugify(values.name),
      country: values.country,
      currency: values.currency,
      timezone: values.timezone,
      industry: values.industry,
    });
    setLoading(false);

    if (error) {
      if (error.status === 400 && error.code === "ORGANIZATION_SLUG_ALREADY_TAKEN") {
        setError("slug", { type: "manual", message: "This slug is already taken. Edit it above." });
      } else {
        toast.error(error.message ?? "Failed to create organization");
      }
      return;
    }

    if (!data) return;

    toast.success(`Welcome to ${data.name}`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="mb-2 flex justify-center">
          <Logo />
        </div>
        <CardTitle className="text-2xl">Create your organization</CardTitle>
        <CardDescription>
          Set up your workspace. You&apos;ll be able to invite teammates next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Organization name</Label>
            <Input
              id="name"
              placeholder="Lagos Logistics Ltd"
              autoComplete="organization"
              {...register("name")}
            />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="slug">Workspace slug</Label>
            <Input
              id="slug"
              placeholder="lagos-logistics"
              {...register("slug")}
            />
            <p className="text-xs text-muted-foreground">
              Used in links and URLs: cargoflow.app/onboarding/{watch("slug") || "your-slug"}
            </p>
            {errors.slug ? <p className="text-sm text-destructive">{errors.slug.message}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label>Country</Label>
            <Controller
              control={control}
              name="country"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
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

          <div className="grid gap-2 sm:grid-cols-2">
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
                  onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create organization"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
