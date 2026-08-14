import { Loader2 } from "lucide-react";

/** Driver app navigation state - tab switches show a spinner instantly. */
export default function DriverLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-xs">Loading…</p>
      </div>
    </div>
  );
}