import { TRPCError } from "@trpc/server";
import { auth } from "@/lib/auth";
import {
  createTRPCRouter,
  orgProcedure,
  protectedProcedure,
  auditedProcedure,
} from "@/trpc/init";
import { updateOrgSchema } from "@/lib/validators/organization";

export const organizationRouter = createTRPCRouter({
  /**
   * The currently active organization for the session, with membership info
   * and a member count. The active org is derived from the session.
   */
  getActive: orgProcedure.query(async ({ ctx }) => {
    const memberCount = await ctx.prisma.member.count({
      where: { organizationId: ctx.organizationId },
    });
    return {
      organization: ctx.organization,
      member: ctx.member,
      memberCount,
    };
  }),

  /**
   * All organizations the signed-in user belongs to (for the org switcher).
   */
  listForUser: protectedProcedure.query(async ({ ctx }) => {
    const members = await ctx.prisma.member.findMany({
      where: { userId: ctx.user.id },
      include: {
        organization: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return members.map(({ organization, role, createdAt }) => ({
      organization,
      role,
      createdAt,
    }));
  }),

  /**
   * Update organization settings. Delegates to Better Auth so the change is
   * enforced by the org plugin's access control.
   */
  update: auditedProcedure({
    resource: "organization",
    action: "UPDATE",
    resourceId: () => null,
  })
    .input(updateOrgSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, headers } = ctx;

      const data = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
      );

      const result = await auth.api.updateOrganization({
        headers,
        body: {
          organizationId,
          data,
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update organization",
        });
      }

      return result;
    }),
});
