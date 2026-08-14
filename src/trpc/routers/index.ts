import { createTRPCRouter } from "@/trpc/init";
import { organizationRouter } from "@/trpc/routers/organization.router";
import { memberRouter } from "@/trpc/routers/member.router";
import { auditRouter } from "@/trpc/routers/audit.router";
import { fleetRouter } from "@/trpc/routers/fleet.router";
import { driverRouter } from "@/trpc/routers/driver.router";
import { assignmentRouter } from "@/trpc/routers/assignment.router";
import { shipmentRouter } from "@/trpc/routers/shipment.router";
import { routeRouter } from "@/trpc/routers/route.router";
import { trackingRouter } from "@/trpc/routers/tracking.router";
import { etaRouter } from "@/trpc/routers/eta.router";
import { notificationRouter } from "@/trpc/routers/notification.router";
import { podRouter } from "@/trpc/routers/pod.router";
import { reportRouter } from "@/trpc/routers/report.router";

/**
 * Root application router. New feature routers are merged here as episodes
 * land (fleet, drivers, shipments, tracking, etc.).
 */
export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  member: memberRouter,
  audit: auditRouter,
  fleet: fleetRouter,
  driver: driverRouter,
  assignment: assignmentRouter,
  shipment: shipmentRouter,
  route: routeRouter,
  tracking: trackingRouter,
  eta: etaRouter,
  notification: notificationRouter,
  pod: podRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;
