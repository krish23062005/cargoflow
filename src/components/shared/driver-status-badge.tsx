import { cn } from "@/lib/utils";
import { getDriverStatusLabel } from "@/lib/constants/drivers";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  ASSIGNED: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  ON_TRIP: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  OFF_DUTY: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function DriverStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />
      {getDriverStatusLabel(status)}
    </Badge>
  );
}
