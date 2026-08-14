import { z } from "zod";
import { createTRPCRouter, requirePermission } from "@/trpc/init";
import {
  resolveRange,
  getFleetUtilization,
  getDeliveryPerformance,
  getDriverScorecard,
  getCostAnalysis,
  getShipmentSummary,
  getReportOverview,
} from "@/server/report";

/**
 * Reporting reads behind `report.view` (owner/admin/dispatcher/viewer).
 * All queries accept an optional date range; defaults to the last 30 days.
 * Aggregations live in src/server/report.ts so server pages could reuse them.
 */
const rangeSchema = z.object({
  from: z.date().nullable().optional(),
  to: z.date().nullable().optional(),
});

export const reportRouter = createTRPCRouter({
  /** Compact snapshot for the dashboard widgets. */
  overview: requirePermission("report.view")
    .input(rangeSchema)
    .query(async ({ ctx, input }) =>
      getReportOverview(resolveRange(input.from, input.to), ctx.organizationId),
    ),

  /** Utilization per vehicle: active time vs. the range window. */
  fleetUtilization: requirePermission("report.view")
    .input(rangeSchema)
    .query(async ({ ctx, input }) =>
      getFleetUtilization(resolveRange(input.from, input.to), ctx.organizationId),
    ),

  /** On-time %, average delay, split by driver and route. */
  deliveryPerformance: requirePermission("report.view")
    .input(rangeSchema)
    .query(async ({ ctx, input }) =>
      getDeliveryPerformance(resolveRange(input.from, input.to), ctx.organizationId),
    ),

  /** Per-driver trips, on-time % and distance covered. */
  driverScorecard: requirePermission("report.view")
    .input(rangeSchema)
    .query(async ({ ctx, input }) =>
      getDriverScorecard(resolveRange(input.from, input.to), ctx.organizationId),
    ),

  /**
   * Cost per vehicle (fuel + maintenance). Currently placeholder figures
   * derived from distance — flagged `placeholder: true` until finance data
   * (fuel logs, maintenance invoices) is wired in.
   */
  costAnalysis: requirePermission("report.view")
    .input(rangeSchema)
    .query(async ({ ctx, input }) =>
      getCostAnalysis(resolveRange(input.from, input.to), ctx.organizationId),
    ),

  /** Shipment volume by status, customer, cargo type and time period. */
  shipmentSummary: requirePermission("report.view")
    .input(rangeSchema)
    .query(async ({ ctx, input }) =>
      getShipmentSummary(resolveRange(input.from, input.to), ctx.organizationId),
    ),
});