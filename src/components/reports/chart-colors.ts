/** Chart palette — fixed hex colors so recharts can render consistently. */
export const CHART_COLORS = {
  slate: "#64748b",
  sky: "#0ea5e9",
  violet: "#818cf8",
  amber: "#f59e0b",
  emerald: "#22c55e",
  red: "#ef4444",
  fuchsia: "#a855f7",
};

export const STATUS_CHART_COLORS: Record<string, string> = {
  PENDING_PICKUP: CHART_COLORS.slate,
  PICKED_UP: CHART_COLORS.sky,
  IN_TRANSIT: CHART_COLORS.violet,
  AT_CHECKPOINT: CHART_COLORS.amber,
  DELIVERED: CHART_COLORS.emerald,
  CANCELLED: CHART_COLORS.red,
  RETURNED: CHART_COLORS.fuchsia,
};