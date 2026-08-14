"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  FileWarning,
  HeartPulse,
  KeyRound,
  Loader2,
  Pencil,
  Phone,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/trpc/client";
import { DriverStatusBadge } from "@/components/shared/driver-status-badge";
import { LicenseStatusBadge } from "@/components/shared/license-status-badge";
import { DRIVER_STATUS_META, type DriverStatus } from "@/lib/constants/drivers";
import { DriverEditDialog } from "@/components/drivers/driver-edit-dialog";
import { AssignmentPanel } from "@/components/assignment/assignment-panel";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString() : "—";

export function DriverDetail({ driverId, canManage }: { driverId: string; canManage: boolean }) {
  const router = useRouter();
  const utils = api.useUtils();
  const driverQuery = api.driver.get.useQuery({ id: driverId });
  const updateMutation = api.driver.update.useMutation();
  const archiveMutation = api.driver.archive.useMutation();
  const resetPinMutation = api.driver.resetPin.useMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [resetPinOpen, setResetPinOpen] = useState(false);
  const [resetPinResult, setResetPinResult] = useState<{ pin: string; delivered: boolean } | null>(null);
  const [resettingPin, setResettingPin] = useState(false);

  const driver = driverQuery.data;

  if (driverQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/drivers" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to drivers
        </Link>
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Driver not found.
        </div>
      </div>
    );
  }

  const current = driver;

  async function changeStatus(status: DriverStatus) {
    setStatusBusy(true);
    await updateMutation.mutateAsync({ id: current.id, status });
    setStatusBusy(false);
    toast.success("Status updated");
    void utils.driver.list.invalidate();
    void utils.driver.summary.invalidate();
  }

  async function archive() {
    setArchiving(true);
    await archiveMutation.mutateAsync({ id: current.id });
    setArchiving(false);
    setArchiveOpen(false);
    toast.success(`${current.name} archived`);
    void utils.driver.list.invalidate();
    void utils.driver.summary.invalidate();
    router.push("/drivers");
  }

  async function resetPin() {
    setResettingPin(true);
    try {
      const result = await resetPinMutation.mutateAsync({ id: current.id });
      setResettingPin(false);
      setResetPinOpen(false);
      setResetPinResult({
        pin: result.pin,
        delivered: result.delivered?.delivered === true,
      });
    } catch {
      setResettingPin(false);
      toast.error("Could not reset PIN");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/drivers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to drivers
        </Link>
        {canManage && (
          <div className="flex items-center gap-2">
            {current.status !== "SUSPENDED" && (
              <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                <Archive /> Archive
              </Button>
            )}
            <Button variant="outline" onClick={() => setResetPinOpen(true)}>
              <KeyRound /> Reset PIN
            </Button>
            <Button onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <User className="size-7 text-primary" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{current.name}</h1>
              <DriverStatusBadge status={current.status} />
              <LicenseStatusBadge status={current.licenseStatus} expiry={current.licenseExpiry} />
            </div>
            <p className="text-sm text-muted-foreground">{current.phone}</p>
          </div>
        </div>
        {canManage && current.status !== "SUSPENDED" && (
          <Select
            value={current.status}
            onValueChange={(v) => changeStatus(v as DriverStatus)}
            disabled={statusBusy}
          >
            <SelectTrigger className="w-44">
              {statusBusy ? <Loader2 className="size-3.5 animate-spin" /> : <SelectValue />}
            </SelectTrigger>
            <SelectContent>
              {DRIVER_STATUS_META.filter((s) => s.value !== "SUSPENDED").map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {current.licenseStatus === "EXPIRED" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <FileWarning className="size-4 shrink-0" />
          This driver&apos;s licence expired on {fmt(current.licenseExpiry)}. They must not be
          assigned until it is renewed.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BadgeCheck className="size-4" /> Licence
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Licence number" value={current.licenseNumber} />
            <DetailItem label="Class" value={current.licenseClass || "—"} />
            <DetailItem label="Expiry" value={fmt(current.licenseExpiry)} />
            <DetailItem label="Joined" value={fmt(current.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Phone className="size-4" /> Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Phone" value={current.phone} />
            <DetailItem label="Email" value={current.email || "—"} />
            <DetailItem label="Address" value={current.address || "—"} />
            <DetailItem label="Blood type" value={current.bloodType || "—"} />
          </CardContent>
        </Card>

        <AssignmentPanel kind="driver" driverId={current.id} canManage={canManage} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <HeartPulse className="size-4" /> Emergency
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Emergency contact" value={current.emergencyContact || "—"} />
            <DetailItem label="Next of kin" value={current.nextOfKinName || "—"} />
            <DetailItem label="Next of kin phone" value={current.nextOfKinPhone || "—"} />
          </CardContent>
        </Card>
      </div>

      {current.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{current.notes}</p>
          </CardContent>
        </Card>
      )}

      <DriverEditDialog driver={current} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive {current.name}?</DialogTitle>
            <DialogDescription>
              The driver will be suspended and can no longer receive assignments. This can be
              reversed later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archive} disabled={archiving}>
              {archiving && <Loader2 className="animate-spin" />}
              Archive driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPinOpen} onOpenChange={setResetPinOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset {current.name}&apos;s PIN?</DialogTitle>
            <DialogDescription>
              A new login PIN will be generated for {current.name}. The old PIN will stop working
              immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPinOpen(false)} disabled={resettingPin}>
              Cancel
            </Button>
            <Button onClick={resetPin} disabled={resettingPin}>
              {resettingPin && <Loader2 className="animate-spin" />}
              Generate new PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetPinResult !== null}
        onOpenChange={(open) => !open && setResetPinResult(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New PIN for {current.name}</DialogTitle>
            <DialogDescription>
              {resetPinResult?.delivered
                ? `We emailed the new PIN to ${current.name}. Keep this copy too, just in case.`
                : "No email address on file, so share the PIN below manually."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/50 p-6">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              New login PIN
            </span>
            <span className="font-mono text-4xl font-bold tracking-[0.3em]">
              {resetPinResult?.pin ?? ""}
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (resetPinResult) {
                  void navigator.clipboard.writeText(resetPinResult.pin);
                  toast.success("PIN copied to clipboard");
                }
              }}
            >
              Copy PIN
            </Button>
            <Button onClick={() => setResetPinResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
