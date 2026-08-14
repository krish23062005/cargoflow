import { cn } from "@/lib/utils";
import { getVehicleStatusLabel } from "@/lib/constants/vehicles";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  IN_USE: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  IN_TRANSIT: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  MAINTENANCE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DECOMMISSIONED: "bg-muted text-muted-foreground",
};

export function VehicleStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />
      {getVehicleStatusLabel(status)}
    </Badge>
  );
}
