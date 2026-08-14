import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Truck className="size-4.5" />
      </span>
      <span className="text-lg tracking-tight">CargoFlow</span>
    </span>
  );
}
