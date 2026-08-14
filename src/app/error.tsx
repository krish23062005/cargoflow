"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Error boundary for the app segment tree. Renders in place of the crashed
 * subtree; "Try again" re-runs the failed render (client-side reset).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
          <AlertTriangle className="size-7" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page. Your data is safe.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}