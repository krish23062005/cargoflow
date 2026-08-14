import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { isRoleAtLeast } from "@/lib/constants/permissions";
import { createAuditLog } from "@/server/audit";

/**
 * Throws when the acting role cannot manage the target member/role.
 */
export function assertRoleChangeAllowed(actorRole: string, targetRole: string) {
  if (!isRoleAtLeast(actorRole, "admin")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only owners and admins can change member roles",
    });
  }
  if (targetRole === "owner" && actorRole !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the owner can grant the owner role",
    });
  }
}

/**
 * Prevents demoting/removing the last owner of an organization, which would
 * orphan it.
 */
export async function assertNotLastOwner(
  organizationId: string,
  memberId: string,
) {
  const target = await prisma.member.findUnique({ where: { id: memberId } });
  if (!target) return;

  if (target.role === "owner") {
    const ownerCount = await prisma.member.count({
      where: { organizationId, role: "owner" },
    });
    if (ownerCount <= 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You cannot remove or demote the last owner",
      });
    }
  }
}

/**
 * Logs a member-related action (invite, role change, removal) to the audit
 * trail. Non-fatal.
 */
export async function auditMemberAction(input: {
  organizationId: string;
  actorUserId: string;
  action: "INVITE" | "ROLE_CHANGE" | "REMOVE_MEMBER";
  metadata: Record<string, string>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await createAuditLog({
    organizationId: input.organizationId,
    userId: input.actorUserId,
    action: input.action,
    resource: "member",
    metadata: input.metadata as never,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
