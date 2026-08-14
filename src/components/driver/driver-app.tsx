"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CircleCheck,
  ClipboardCheck,
  Download,
  Keyboard,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Truck,
} from "lucide-react";
import type { DriverContext } from "@/server/driver";
import { getShipmentStatusLabel } from "@/lib/constants/shipments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShipmentStatusBadge } from "@/components/shared/shipment-status-badge";
import { Etag } from "@/components/driver/eta";
import { DriverMap } from "@/components/driver/driver-map";
import { useDriverTracking } from "@/components/driver/use-driver-tracking";
import { offlineCapablePost } from "@/lib/offline/mutations";
import { cn } from "@/lib/utils";

const POLL_MS = 15000;

const ACTION_BY_STATUS: Record<string, { action: "start_trip" | "departed" | "arrived"; label: string; icon: "pickup" | "depart" | "arrive" }[]> = {
  PENDING_PICKUP: [{ action: "start_trip", label: "Start trip", icon: "pickup" }],
  PICKED_UP: [{ action: "departed", label: "Departed", icon: "depart" }],
  IN_TRANSIT: [{ action: "arrived", label: "Arrived", icon: "arrive" }],
  AT_CHECKPOINT: [{ action: "arrived", label: "Arrived", icon: "arrive" }],
};

export function DriverApp({ initial }: { initial: DriverContext }) {
  const router = useRouter();
  const [ctx, setCtx] = useState<DriverContext>(initial);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);

  const shipment = ctx.shipment;
  const assignment = ctx.assignment;
  const vehicleId = assignment?.vehicleId;

  const { liveCoord, livePoint, trackState } = useDriverTracking(vehicleId);

  const showToast = useCallback((t: { kind: "error" | "ok"; text: string }) => {
    setToast(t);
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, []);

  // Poll the server context so status changes made elsewhere show up.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/driver/context");
        if (res.status === 401) {
          router.replace("/driver/login");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as DriverContext;
        if (alive) {
          setCtx(data);
          setLastUpdate(new Date());
        }
      } catch {
        /* transient network error — keep last known context */
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router]);

  // Refresh the "last synced Xs ago" label each second.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Surface the browser's "Add to Home Screen" prompt so drivers can install.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    const promptEvent = installPrompt as Event & { prompt: () => Promise<void> };
    await promptEvent.prompt().catch(() => {});
    setInstallPrompt(null);
  }

  async function runAction(action: string, label: string) {
    setBusy(action);
    try {
      const result = await offlineCapablePost("/api/driver/actions", { action }, "action");
      if (result.sent) {
        const data = result.body as { status?: string } | null;
        showToast({
          kind: "ok",
          text: `${label} recorded — ${getShipmentStatusLabel(data?.status ?? "")}`,
        });
        const refresh = await fetch("/api/driver/context");
        if (refresh.ok) setCtx((await refresh.json()) as DriverContext);
        return;
      }
      if (result.queued) {
        showToast({ kind: "ok", text: `${label} queued — will sync automatically when back online` });
        return;
      }
      const body = result.body as { error?: string } | null;
      showToast({ kind: "error", text: body?.error ?? "Action failed" });
    } catch {
      showToast({ kind: "error", text: "Network error. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/driver/logout", { method: "POST" });
    router.replace("/driver/login");
    router.refresh();
  }

  const actions = shipment ? ACTION_BY_STATUS[shipment.status] ?? [] : [];
  const updatedAgo = lastUpdate
    ? `${Math.max(0, Math.round((now - lastUpdate.getTime()) / 1000))}s`
    : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {ctx.organization.name}
                <span
                  className={cn(
                    "inline-block size-1.5 rounded-full",
                    trackState === "active" ? "bg-emerald-500" : "bg-muted-foreground",
                  )}
                  aria-hidden
                />
              </p>
              <p className="text-xs text-muted-foreground">Driver · {ctx.driver.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => document.getElementById("pin-dialog")?.classList.remove("hidden")}
              title="Change PIN"
            >
              <Keyboard className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={logout} title="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        {!installed && installPrompt ? (
          <div className="border-t bg-primary/5 px-4 py-2">
            <button
              type="button"
              onClick={installApp}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 py-2 text-sm font-medium text-primary active:bg-primary/10"
            >
              <Download className="size-4" />
              Install driver app
            </button>
          </div>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 pb-8">
        {toast ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white",
              toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600",
            )}
            role="status"
          >
            {toast.kind === "ok" ? <CircleCheck className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
            {toast.text}
          </div>
        ) : null}

        {/* Status strip */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-3 divide-x">
              <div className="flex flex-col items-center gap-1 py-3">
                <span className="text-[11px] text-muted-foreground">Vehicle</span>
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <Truck className="size-3.5 text-muted-foreground" />
                  {assignment?.vehicle.plateNumber ?? "—"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3">
                <span className="text-[11px] text-muted-foreground">Location</span>
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <Activity className={cn("size-3.5", trackState === "active" ? "text-emerald-500" : "text-muted-foreground")} />
                  {trackState === "active" ? (livePoint.speedKmh != null ? `${livePoint.speedKmh} km/h` : "Live") : trackState === "off" ? "No vehicle" : "Off"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3">
                <span className="text-[11px] text-muted-foreground">Sync</span>
                <span className="text-sm font-semibold">{updatedAgo ? `${updatedAgo} ago` : "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipment card */}
        {shipment ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="size-4 text-muted-foreground" />
                  {shipment.trackingNumber}
                </CardTitle>
                <ShipmentStatusBadge status={shipment.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {shipment.customerName} · {shipment.cargoType}
              </p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {ctx.route && ctx.route.waypoints.length > 0 ? (
                <DriverMap
                  waypoints={ctx.route.waypoints}
                  geometry={ctx.route.geometry}
                  vehicle={liveCoord ?? (ctx.position?.lat != null && ctx.position.lng != null
                    ? { lat: ctx.position.lat, lng: ctx.position.lng }
                    : undefined)}
                  labels={{ origin: shipment.originAddress, destination: shipment.destinationAddress }}
                />
              ) : null}
              <RouteLine from={shipment.originAddress} to={shipment.destinationAddress} />
              <Etag eta={ctx.eta} status={shipment.status} />
              {shipment.cargoDescription ? (
                <p className="text-xs text-muted-foreground">{shipment.cargoDescription}</p>
              ) : null}

              {actions.length > 0 ? (
                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  {actions.map((a) => (
                    <Button
                      key={a.action}
                      onClick={() => runAction(a.action, a.label)}
                      disabled={busy === a.action || busy !== null}
                      className="w-full"
                    >
                      {busy === a.action ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : ACTION_ICON[a.icon] ? (
                        <span className="mr-2">{ACTION_ICON[a.icon]}</span>
                      ) : null}
                      {a.label}
                    </Button>
                  ))}
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => document.getElementById("issue-dialog")?.classList.remove("hidden")}
                  >
                    <AlertTriangle className="mr-2 size-4" />
                    Report issue
                  </Button>
                  <Button variant="outline" className="w-full sm:col-span-2" asChild>
                    <Link href="/driver/pod">
                      <ClipboardCheck className="mr-2 size-4" />
                      Proof of delivery
                    </Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <Package className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No active shipment</p>
              <p className="text-xs text-muted-foreground">
                You have {assignment ? "an assigned vehicle" : "no assigned vehicle"}. Your dispatcher will assign a shipment soon.
              </p>
              {assignment ? (
                <Badge variant="secondary" className="mt-1">
                  {assignment.vehicle.make} {assignment.vehicle.model} · {assignment.vehicle.plateNumber}
                </Badge>
              ) : null}
            </CardContent>
          </Card>
        )}

        {!shipment && !assignment ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium">Waiting for dispatcher</p>
            </CardContent>
          </Card>
        ) : null}
      </main>

      <IssueDialog shipmentId={shipment?.id ?? null} onDone={showToast} />
      <PinDialog onDone={showToast} />
    </div>
  );
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  pickup: <Package className="size-4" />,
  depart: <Navigation className="size-4" />,
  arrive: <MapPin className="size-4" />,
};

function RouteLine({ from, to }: { from: string; to: string }) {
  return (
    <div className="grid gap-1.5">
      {[from, to].map((label, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="mt-0.5 flex flex-col items-center">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                i === 0 ? "bg-primary" : "bg-destructive",
              )}
            />
            {i === 0 ? <span className="my-0.5 h-3 w-px bg-border" /> : null}
          </div>
          <span
            className={cn(
              "line-clamp-2 text-sm",
              i === 0 ? "font-medium" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function IssueDialog({
  shipmentId,
  onDone,
}: {
  shipmentId: string | null;
  onDone: (t: { kind: "error" | "ok"; text: string }) => void;
}) {
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shipmentId) return;
    setSending(true);
    try {
      const result = await offlineCapablePost(
        "/api/driver/actions",
        { action: "issue", description },
        "issue",
      );
      if (result.queued) {
        setDescription("");
        onDone({ kind: "ok", text: "Issue queued — will send when back online" });
        document.getElementById("issue-dialog")?.classList.add("hidden");
        return;
      }
      if (!result.sent) {
        const data = result.body as { error?: string } | null;
        onDone({ kind: "error", text: data?.error ?? "Could not report issue" });
        return;
      }
      setDescription("");
      onDone({ kind: "ok", text: "Issue reported to your team" });
      document.getElementById("issue-dialog")?.classList.add("hidden");
    } catch {
      onDone({ kind: "error", text: "Network error. Try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div id="issue-dialog" className="hidden fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => document.getElementById("issue-dialog")?.classList.add("hidden")}>
      <form
        onSubmit={submit}
        className="grid w-full max-w-sm gap-3 rounded-2xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Report an issue</h2>
        <div className="grid gap-2">
          <Label htmlFor="issue">Description</Label>
          <Input
            id="issue"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Delayed at border crossing, or vehicle breakdown"
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => document.getElementById("issue-dialog")?.classList.add("hidden")}>
            Cancel
          </Button>
          <Button type="submit" disabled={sending || !shipmentId}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PinDialog({
  onDone,
}: {
  onDone: (t: { kind: "error" | "ok"; text: string }) => void;
}) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/driver/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onDone({ kind: "error", text: data.error ?? "Could not change PIN" });
        return;
      }
      setCurrentPin("");
      setNewPin("");
      onDone({ kind: "ok", text: "PIN updated" });
      document.getElementById("pin-dialog")?.classList.add("hidden");
    } catch {
      onDone({ kind: "error", text: "Network error. Try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div id="pin-dialog" className="hidden fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => document.getElementById("pin-dialog")?.classList.add("hidden")}>
      <form
        onSubmit={submit}
        className="grid w-full max-w-sm gap-3 rounded-2xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Change PIN</h2>
        <div className="grid gap-2">
          <Label htmlFor="currentPin">Current PIN</Label>
          <Input
            id="currentPin"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="newPin">New PIN (4–8 digits)</Label>
          <Input
            id="newPin"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => document.getElementById("pin-dialog")?.classList.add("hidden")}>
            Cancel
          </Button>
          <Button type="submit" disabled={sending}>
            {sending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}