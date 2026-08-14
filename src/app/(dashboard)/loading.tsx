/**
 * Dashboard loading state. The layout (sidebar/topbar) stays mounted during
 * navigations, so this only replaces the content area - a card skeleton makes
 * tab switches feel instant instead of showing a blank flash.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}