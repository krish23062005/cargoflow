"use client";

import { useState } from "react";
import {
  Calendar,
  Loader2,
  Route,
  User,
  Truck,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/trpc/client";
import { AssignCandidates } from "@/components/assignment/assign-candidates";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props =
  | { kind: "vehicle"; vehicleId: string; canManage: boolean }
  | { kind: "driver"; driverId: string; canManage: boolean };

export function AssignmentPanel(props: Props) {
  const router = useRouter();
  const utils = api.useUtils();

  const isVehicle = props.kind === "vehicle";
  const entityId = isVehicle ? props.vehicleId : props.driverId;

  const vehicleActiveQuery = api.assignment.getActiveForVehicle.useQuery(
    { assignmentId: entityId },
    { enabled: isVehicle },
  );
  const driverActiveQuery = api.assignment.getActiveForDriver.useQuery(
    { assignmentId: entityId },
    { enabled: !isVehicle },
  );

  const activeQuery = isVehicle ? vehicleActiveQuery : driverActiveQuery;

  const unassignMutation = api.assignment.unassign.useMutation();
  const [assignOpen, setAssignOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const active = activeQuery.data ?? null;
  const linkedDriver = isVehicle ? (vehicleActiveQuery.data?.driver ?? null) : null;
  const linkedVehicle = !isVehicle ? (driverActiveQuery.data?.vehicle ?? null) : null;

  async function unassign() {
    if (!active) return;
    setBusy(true);
    await unassignMutation.mutateAsync({ assignmentId: active.id });
    setBusy(false);
    setUnassignOpen(false);
    toast.success("Assignment ended");
    void utils.assignment.getActiveForVehicle.invalidate();
    void utils.assignment.getActiveForDriver.invalidate();
    void utils.fleet.summary.invalidate();
    void utils.driver.summary.invalidate();
    void utils.fleet.get.invalidate();
    void utils.driver.get.invalidate();
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Route className="size-4" /> Current assignment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeQuery.isLoading ? (
          <Skeleton className="h-16" />
        ) : active ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {isVehicle ? (
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="size-5 text-primary" />
                </div>
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Truck className="size-5 text-primary" />
                </div>
              )}
              <div>
                <p className="font-medium">
                  {isVehicle
                    ? linkedDriver?.name ?? "Unknown driver"
                    : `${linkedVehicle?.make} ${linkedVehicle?.model} (${linkedVehicle?.plateNumber})`}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  Assigned {new Date(active.startDate).toLocaleDateString()}
                  {isVehicle ? ` · ${linkedDriver?.phone ?? ""}` : ""}
                </p>
              </div>
            </div>
            {props.canManage && (
              <Button variant="outline" onClick={() => setUnassignOpen(true)}>
                <Undo2 /> Unassign
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isVehicle
              ? "No driver assigned to this vehicle."
              : "No vehicle assigned to this driver."}
          </p>
        )}

        {props.canManage && !active && (
          <Button className="mt-4" onClick={() => setAssignOpen(true)} disabled={assignOpen}>
            {isVehicle ? "Assign a driver" : "Assign a vehicle"}
          </Button>
        )}

        {props.canManage && active && (
          <p className="mt-3 text-xs text-muted-foreground">
            Reassigning requires ending the current assignment first.
          </p>
        )}
      </CardContent>

      <AssignCandidates
        kind={props.kind}
        entityId={entityId}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />

      <Dialog open={unassignOpen} onOpenChange={setUnassignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>End this assignment?</DialogTitle>
            <DialogDescription>
              {isVehicle
                ? `${linkedDriver?.name ?? "The driver"} will no longer be assigned to this vehicle.`
                : `This vehicle will no longer be assigned to this driver.`}{" "}
              Both will return to available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnassignOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={unassign} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              End assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}