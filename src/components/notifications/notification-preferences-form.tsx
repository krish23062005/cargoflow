"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NOTIFICATION_TYPE_META } from "@/lib/constants/notifications";

/**
 * Per-member notification preferences. Category toggles control which event
 * types create an in-app notification; the email/SMS switches opt into the
 * (placeholder) extra channels.
 */
export function NotificationPreferencesForm() {
  const prefs = api.notification.preferences.useQuery(undefined);
  const update = api.notification.updatePreferences.useMutation({
    onSuccess: () => toast.success("Preferences saved"),
    onError: () => toast.error("Could not save preferences"),
  });

  const [dirty, setDirty] = useState(false);

  if (prefs.isLoading) {
    return <Skeleton className="h-64" />;
  }

  const p = prefs.data;

  const categoryKey = (type: string): "shipmentStatus" | "vehicleAlert" | "driverAlert" | "systemAlert" =>
    type === "SHIPMENT_STATUS_CHANGE"
      ? "shipmentStatus"
      : type === "VEHICLE_ALERT"
        ? "vehicleAlert"
        : type === "DRIVER_ALERT"
          ? "driverAlert"
          : "systemAlert";

  const categories = NOTIFICATION_TYPE_META.map((meta) => ({
    ...meta,
    enabled: p ? Boolean(p[categoryKey(meta.value)]) : true,
  }));

  const toggle = (key: "shipmentStatus" | "vehicleAlert" | "driverAlert" | "systemAlert") => {
    if (!p) return;
    const next = { ...p, [key]: !p[key] };
    update.mutate(next);
    setDirty(true);
  };

  const toggleChannel = (key: "email" | "sms") => {
    if (!p) return;
    update.mutate({ ...p, [key]: !p[key] });
    setDirty(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
        <CardDescription>
          Choose which updates you receive and on which channels. Changes apply
          to this organization only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {categories.map((c) => (
            <div
              key={c.value}
              className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.description}</p>
              </div>
              <Switch
                checked={c.enabled}
                onCheckedChange={() => toggle(categoryKey(c.value))}
              />
            </div>
          ))}
        </div>

        <div className="rounded-lg border px-4 py-3">
          <p className="mb-1 text-sm font-medium">Extra delivery channels</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Email and SMS delivery are coming soon — toggling them on records
            your intent and routes alerts to those channels when configured.
          </p>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-email">Email me</Label>
            <Switch
              id="pref-email"
              checked={Boolean(p?.email)}
              onCheckedChange={() => toggleChannel("email")}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <Label htmlFor="pref-sms">Text me (SMS)</Label>
            <Switch
              id="pref-sms"
              checked={Boolean(p?.sms)}
              onCheckedChange={() => toggleChannel("sms")}
            />
          </div>
        </div>

        {update.isPending && (
          <Button size="sm" disabled className="pointer-events-none">
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </Button>
        )}
        {dirty && !update.isPending && (
          <Button size="sm" variant="outline" onClick={() => setDirty(false)}>
            Saved
          </Button>
        )}
      </CardContent>
    </Card>
  );
}