"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useState } from "react";
import { AlertTriangle, Loader2, MapPin, RotateCcw, Save, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/trpc/client";
import { WaypointList } from "@/components/tracking/waypoint-list";
import { createRouteSchema, type Waypoint } from "@/lib/validators/route";
import {
  defaultWaypointType,
  formatDistanceKm,
  formatDurationMin,
} from "@/lib/constants/routes";
import type { RouteCalculation } from "@/server/route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function RouteBuilder() {
  const router = useRouter();
  const utils = api.useUtils();
  const createMutation = api.route.create.useMutation();

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [calc, setCalc] = useState<{ result: RouteCalculation | null; error: string | null }>({
    result: null,
    error: null,
  });
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  function addWaypoint(lat: number, lng: number) {
    setWaypoints((prev) => [
      ...prev,
      { lat, lng, name: "", type: defaultWaypointType(prev.length, prev.length + 1) },
    ]);
  }

  function updateWaypoint(index: number, patch: Partial<Waypoint>) {
    setWaypoints((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  function removeWaypoint(index: number) {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex((sel) => (sel === index ? null : sel));
  }

  function moveWaypoint(index: number, direction: -1 | 1) {
    const target = index + direction;
    setWaypoints((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelectedIndex(target);
  }

  async function handleCalculate() {
    if (waypoints.length < 2) {
      toast.warning("Add at least a pickup and a dropoff point before calculating.");
      return;
    }
    setCalculating(true);
    try {
      const result = await utils.route.calculate.fetch({ waypoints });
      setCalc({ result, error: null });
    } catch {
      setCalc((s) => ({ result: s.result, error: "Could not calculate this route — check your waypoints." }));
    } finally {
      setCalculating(false);
    }
  }

  async function handleSave() {
    const geometry =
      calc.result?.geometry ??
      (waypoints.length >= 2
        ? waypoints.map((w) => [w.lat, w.lng] as [number, number])
        : null);

    const parsed = createRouteSchema.safeParse({
      name,
      notes,
      waypoints,
      geometry,
      totalDistanceKm: calc.result?.totalDistanceKm ?? null,
      estimatedDurationMin: calc.result?.estimatedDurationMin ?? null,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      const route = await createMutation.mutateAsync(parsed.data);
      toast.success("Route saved");
      void utils.route.list.invalidate();
      router.push(`/routes/${route.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the route");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 sm:max-w-md">
          <Label htmlFor="route-name">Route name *</Label>
          <Input
            id="route-name"
            placeholder="Lagos → Ibadan express"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={waypoints.length < 2 || calculating}
            onClick={handleCalculate}
          >
            {calculating ? <Loader2 className="animate-spin" /> : <RouteIcon />}
            Compute route
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || waypoints.length < 2}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save route
          </Button>
        </div>
      </div>

      {calc.result && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <MapPin className="size-4 text-primary" />
            {formatDistanceKm(calc.result.totalDistanceKm)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <RouteIcon className="size-4 text-primary" />
            {formatDurationMin(calc.result.estimatedDurationMin)}
          </span>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
              calc.result.provider === "osrm"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {calc.result.provider === "osrm" ? "OSRM driving route" : "Approximate straight-line"}
          </span>
        </div>
      )}

      {calc.error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {calc.error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-[440px]">
          <RouteMap
            waypoints={waypoints}
            geometry={calc.result?.geometry ?? null}
            interactive
            onAddWaypoint={addWaypoint}
            onMarkerClick={setSelectedIndex}
            className="h-full"
          />
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Waypoints ({waypoints.length})</CardTitle>
            {waypoints.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setWaypoints([]);
                  setSelectedIndex(null);
                  setCalc({ result: null, error: null });
                }}
              >
                <RotateCcw /> Clear
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Click the map to drop points. Use the list to name, retype, reorder or delete them.
            </p>
            <WaypointList
              waypoints={waypoints}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onUpdate={updateWaypoint}
              onRemove={removeWaypoint}
              onMove={moveWaypoint}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              placeholder="Border crossings, fuel prices, danger zones, driver instructions…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}