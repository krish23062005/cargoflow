import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const LICENSE_STYLES: Record<string, string> = {
  VALID: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  EXPIRING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  EXPIRED: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function LicenseStatusBadge({
  status,
  expiry,
}: {
  status: "VALID" | "EXPIRING" | "EXPIRED";
  expiry: Date | string;
}) {
  const label =
    status === "VALID"
      ? "Licence valid"
      : status === "EXPIRING"
        ? `Expires ${new Date(expiry).toLocaleDateString()}`
        : `Expired ${new Date(expiry).toLocaleDateString()}`;

  return (
    <Badge variant="outline" className={cn(LICENSE_STYLES[status])}>
      {label}
    </Badge>
  );
}
