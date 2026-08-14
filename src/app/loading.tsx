import { Loader2 } from "lucide-react";

/** Instant fallback shown during any navigation that has no segment loading file. */
export default function RootLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
      <Loader2 className="size-7 animate-spin" />
      <span className="sr-only">Loading</span>
    </div>
  );
}