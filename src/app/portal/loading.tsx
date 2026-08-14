import { Loader2 } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <span className="sr-only">Loading</span>
    </div>
  );
}