"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Global error boundary - catches errors in the root layout itself, so it must
 * provide its own <html>/<body> (the root layout is unreachable when it fails).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <div className="grid min-h-dvh place-items-center p-6">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-7" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Something went wrong</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                An unexpected error crashed the app shell. Please reload to continue.
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
      </body>
    </html>
  );
}