import { Clock, Route } from "lucide-react";
import type { EtaLive } from "@/server/eta";
import { formatEtaDuration } from "@/lib/utils/eta-calculator";
import { cn } from "@/lib/utils";

export function Etag({ eta, status }: { eta: EtaLive | null; status: string }) {
  if (status === "DELIVERED") {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Route className="size-4" />
        Delivered
      </p>
    );
  }
  if (!eta) {
    return (
      <p className="text-xs text-muted-foreground">Route settlement pending…</p>
    );
  }

  const minutes = eta.minutes != null ? formatEtaDuration(eta.minutes) : null;
  const delayText =
    eta.isDelayed && eta.delayMin != null && eta.delayMin > 0
      ? ` · ${eta.delayMin} min behind`
      : "";

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl bg-muted px-3 py-2.5",
        eta.isDelayed && "bg-amber-500/10",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm">
        <Clock className="size-4 text-muted-foreground" />
        {eta.isDelayed ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {minutes ?? "Late"}{delayText}
          </span>
        ) : (
          <span className="font-medium">Arrive {minutes ?? "soon"}</span>
        )}
      </span>
      {eta.remainingKm != null ? (
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.round(eta.remainingKm)} km to go
        </span>
      ) : null}
    </div>
  );
}