import { cn } from "@/lib/utils";
import { getShipmentStatusLabel } from "@/lib/constants/shipments";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PICKUP: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PICKED_UP: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  IN_TRANSIT: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  AT_CHECKPOINT: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  DELIVERED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  CANCELLED: "bg-red-500/15 text-red-600 dark:text-red-400",
  RETURNED: "bg-muted text-muted-foreground",
};

export function ShipmentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />
      {getShipmentStatusLabel(status)}
    </Badge>
  );
}