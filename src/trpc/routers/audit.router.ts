import {
  createTRPCRouter,
  requirePermission,
} from "@/trpc/init";
import { listAuditLogsSchema } from "@/lib/validators/member";
import { listAuditLogs } from "@/server/audit";

export const AUDIT_RESOURCES = [
  "organization",
  "member",
  "fleet",
  "driver",
  "shipment",
  "route",
  "tracking",
  "notification",
] as const;

export const auditRouter = createTRPCRouter({
  /**
   * Filterable, paginated audit log for the active organization.
   * Owners and admins only.
   */
  list: requirePermission("audit.view")
    .input(listAuditLogsSchema)
    .query(async ({ ctx, input }) => {
      return listAuditLogs({
        organizationId: ctx.organizationId,
        page: input.page,
        pageSize: input.pageSize,
        action: input.action ?? null,
        resource: input.resource ?? null,
        search: input.search ?? null,
      });
    }),

  /**
   * Recent activity (last 10 entries) for the dashboard feed.
   */
  recent: requirePermission("audit.view").query(async ({ ctx }) => {
    return ctx.prisma.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }),
});
