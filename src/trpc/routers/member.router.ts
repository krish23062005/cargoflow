import { TRPCError } from "@trpc/server";
import { auth } from "@/lib/auth";
import {
  createTRPCRouter,
  protectedProcedure,
  requireRole,
  auditedProcedure,
} from "@/trpc/init";
import {
  inviteMemberSchema,
  updateRoleSchema,
  removeMemberSchema,
  cancelInvitationSchema,
  getInvitationSchema,
} from "@/lib/validators/member";
import {
  assertRoleChangeAllowed,
  assertNotLastOwner,
} from "@/server/member";
import { notifyByPermission } from "@/server/notification";
import { buildInviteUrl, sendInvitationEmail } from "@/server/email";

/**
 * Member management — owners and admins only, per the permission matrix.
 * Delegates to Better Auth's organization endpoints so the org plugin's
 * access control is enforced, and layers our own guardrails + audit trail on
 * top.
 */
export const memberRouter = createTRPCRouter({
  /**
   * List all members of the active organization with their user info.
   */
  list: requireRole("admin").query(async ({ ctx }) => {
    const result = await auth.api.listMembers({
      headers: ctx.headers,
      query: { organizationId: ctx.organizationId },
    });
    return result;
  }),

  /**
   * Pending invitations for the active organization.
   */
  listInvitations: requireRole("admin").query(async ({ ctx }) => {
    const invitations = await auth.api.listInvitations({
      headers: ctx.headers,
      query: { organizationId: ctx.organizationId },
    });
    return invitations;
  }),

  /**
   * Fetch a single pending invitation (org name, role, inviter). Requires a
   * session — used by the accept page so a signed-in invitee can review the
   * invitation before accepting. The invitee is not a member yet, so this is
   * a plain protected (not org-scoped) procedure.
   */
  getInvitation: protectedProcedure
    .input(getInvitationSchema)
    .query(async ({ ctx, input }) => {
      const invitation = await auth.api.getInvitation({
        headers: ctx.headers,
        query: { id: input.invitationId },
      });
      return invitation;
    }),

  /**
   * Invite a member by email. Audited. Emails the recipient (or returns a
   * copyable link when Resend isn't configured).
   */
  invite: auditedProcedure({
    permission: "member.invite",
    resource: "member",
    action: "INVITE",
    metadata: (input) => {
      const { email, role } = input as { email?: string; role?: string };
      return { email: email ?? "", role: role ?? "" };
    },
  })
    .input(inviteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const invitation = await auth.api.createInvitation({
        headers: ctx.headers,
        body: {
          email: input.email,
          role: input.role,
          organizationId: ctx.organizationId,
        },
      });

      // Let the org's admins know a new invite is pending.
      void notifyByPermission(ctx.prisma, {
        organizationId: ctx.organizationId,
        permission: "member.invite",
        type: "SYSTEM",
        title: `Invitation sent to ${input.email}`,
        body: `${ctx.user.name} invited ${input.email} as ${input.role}.`,
        link: "/settings/members",
        excludeUserId: ctx.user.id,
      });

      // Send the real email. Never throws — falls back to dev mode (logged to
      // the server console) when Resend isn't configured.
      const delivery = await sendInvitationEmail({
        to: input.email,
        orgName: ctx.organization.name,
        inviterName: ctx.user.name,
        role: input.role,
        invitationId: invitation.id,
      });

      return {
        ...invitation,
        emailDelivered: delivery.delivered,
        emailChannel: delivery.channel,
        emailReason: delivery.delivered ? undefined : delivery.reason,
        inviteUrl: buildInviteUrl(invitation.id),
      };
    }),

  /**
   * Change a member's role. Audited.
   */
  updateRole: auditedProcedure({
    permission: "member.update_role",
    resource: "member",
    action: "ROLE_CHANGE",
    resourceId: (input) => (input as { memberId?: string })?.memberId ?? null,
  })
    .input(updateRoleSchema)
    .mutation(async ({ ctx, input }) => {
      assertRoleChangeAllowed(ctx.member.role, input.role);
      await assertNotLastOwner(ctx.organizationId, input.memberId);

      const updated = await auth.api.updateMemberRole({
        headers: ctx.headers,
        body: {
          role: input.role,
          memberId: input.memberId,
          organizationId: ctx.organizationId,
        },
      });
      return updated;
    }),

  /**
   * Remove a member from the organization. Audited.
   */
  remove: auditedProcedure({
    permission: "member.remove",
    resource: "member",
    action: "REMOVE_MEMBER",
    resourceId: (input) => (input as { memberId?: string })?.memberId ?? null,
  })
    .input(removeMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.member.findUnique({
        where: { id: input.memberId },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }
      if (target.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Member not found" });
      }
      if (target.id === ctx.member.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use the leave flow to remove yourself",
        });
      }

      await assertNotLastOwner(ctx.organizationId, input.memberId);

      const result = await auth.api.removeMember({
        headers: ctx.headers,
        body: {
          memberIdOrEmail: input.memberId,
          organizationId: ctx.organizationId,
        },
      });
      return result;
    }),

  /**
   * Cancel a pending invitation. Audited.
   */
  cancelInvitation: auditedProcedure({
    permission: "member.invite",
    resource: "member",
    action: "DELETE",
    resourceId: (input) => (input as { invitationId?: string })?.invitationId ?? null,
  })
    .input(cancelInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await auth.api.cancelInvitation({
        headers: ctx.headers,
        body: { invitationId: input.invitationId },
      });
      return result;
    }),
});
