import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils/slug";
import {
  ROLE_HIERARCHY,
  type OrgRole,
} from "@/lib/constants/permissions";
import type { Organization, Member } from "@/generated/prisma/client";

export { ROLE_HIERARCHY, type OrgRole };

export function isRoleAtLeast(role: string, minimum: OrgRole) {
  const index = ROLE_HIERARCHY.indexOf(role as OrgRole);
  const minIndex = ROLE_HIERARCHY.indexOf(minimum);
  if (index === -1) return false;
  return index <= minIndex;
}

/**
 * Loads a member record for the given user within an organization.
 * Returns `null` when the user is not a member.
 */
export async function findMembership(userId: string, organizationId: string) {
  return prisma.member.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });
}

/**
 * Resolves the active organization for a user from the session's
 * `activeOrganizationId`. Returns `null` when there is no active org.
 */
export async function getActiveOrganization(
  userId: string,
  activeOrganizationId?: string | null,
): Promise<{ organization: Organization; member: Member } | null> {
  if (!activeOrganizationId) return null;

  const member = await findMembership(userId, activeOrganizationId);
  if (!member) return null;

  const organization = await prisma.organization.findUnique({
    where: { id: activeOrganizationId },
  });

  if (!organization) return null;

  return { organization, member };
}

/**
 * Throws a tRPC FORBIDDEN error when the user is not a member of the org.
 */
export async function assertMembership(userId: string, organizationId: string) {
  const member = await findMembership(userId, organizationId);
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }
  return member;
}

export { slugify };
