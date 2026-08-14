"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Link2,
  Loader2,
  MapPin,
  Package,
  Route as RouteIcon,
  Trash2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  getWaypointTypeMeta,
  formatDistanceKm,
  formatDurationMin,
} from "@/lib/constants/routes";
import type { Waypoint } from "@/lib/validators/route";

const RouteMap = dynamic(
  () => import("@/components/tracking/route-map").then((m) => m.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full animate-pulse items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

function fmt(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RouteDetail({ routeId, canManage }: { routeId: string; canManage: boolean }) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: route, isLoading } = api.route.get.useQuery({ id: routeId });
  const shipmentsQuery = api.shipment.list.useQuery(
    { pageSize: 50, page: 1 },
    { enabled: canManage },
  );
  const linkMutation = api.route.linkShipment.useMutation();
  const removeMutation = api.route.remove.useMutation();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linking, setLinking] = useState(false);

  if (isLoading || !route) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[420px] w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const waypoints = route.waypoints as unknown as Waypoint[];
  const geometry = route.geometry as unknown as [number, number][] | null;
  const current = route;

  async function handleLink(value: string) {
    setLinking(true);
    try {
      await linkMutation.mutateAsync({ id: current.id, shipmentId: value || null });
      toast.success(value ? "Route linked to shipment" : "Route unlinked");
      void utils.route.get.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the shipment link");
    } finally {
      setLinking(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeMutation.mutateAsync({ id: current.id });
      toast.success("Route deleted");
      void utils.route.list.invalidate();
      router.push("/routes");
    } catch {
      toast.error("Could not delete the route");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/routes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to routes
        </Link>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10">
            <RouteIcon className="size-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{route.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="size-3.5" /> Created {fmt(route.createdAt)} ·{" "}
              {waypoints.length} waypoints
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border bg-card px-3 py-2 text-sm font-medium">
            {formatDistanceKm(route.totalDistanceKm)}
          </span>
          <span className="rounded-lg border bg-card px-3 py-2 text-sm font-medium">
            {formatDurationMin(route.estimatedDurationMin)}
          </span>
        </div>
      </div>

      <div className="h-[420px]">
        <RouteMap waypoints={waypoints} geometry={geometry} className="h-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waypoints</CardTitle>
          </CardHeader>
          <CardContent>
            {waypoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No waypoints saved.</p>
            ) : (
              <ol className="space-y-2">
                {waypoints.map((w, i) => {
                  const meta = getWaypointTypeMeta(w.type);
                  return (
                    <li key={`${i}-${w.lat.toFixed(5)}`} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: meta.color }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{w.name || meta.label}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                          <span className="ml-2 text-muted-foreground/70">· {meta.label}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4" /> Linked shipment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {route.shipment ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                      <Package className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">
                        {route.shipment.trackingNumber}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {route.shipment.customerName}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" disabled={linking} onClick={() => handleLink("")}>
                    {linking ? <Loader2 className="animate-spin" /> : <Unlink />}
                    Unlink
                  </Button>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4" /> Not linked to any shipment yet.
                </p>
              )}

              {canManage && (
                <Select value={route.shipment?.id ?? ""} onValueChange={handleLink} disabled={linking}>
                  <SelectTrigger className="w-full">
                    {linking ? <Loader2 className="size-3.5 animate-spin" /> : <SelectValue />}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="none" value="">
                      Unlinked
                    </SelectItem>
                    {(shipmentsQuery.data?.items ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id} disabled={s.routeId === routeId}>
                        {s.trackingNumber} · {s.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(() => {
                const alreadyLinked = (shipmentsQuery.data?.items ?? []).find(
                  (s) => s.routeId && s.routeId !== routeId,
                );
                return alreadyLinked ? (
                  <p className="text-xs text-muted-foreground">
                    {alreadyLinked.trackingNumber} is already linked to another route.
                  </p>
                ) : null;
              })()}
            </CardContent>
          </Card>

          {route.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{route.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this route?</DialogTitle>
            <DialogDescription>
              &ldquo;{route.name}&rdquo; will be permanently removed. A linked shipment keeps its
              other data but loses this route reference.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin" />}
              Delete route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}