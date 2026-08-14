import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Audit log actions. Kept loose (string) so future episodes can extend the
 * set without touching types everywhere.
 */
export const AUDIT_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  INVITE: "INVITE",
  JOIN: "JOIN",
  ROLE_CHANGE: "ROLE_CHANGE",
  REMOVE_MEMBER: "REMOVE_MEMBER",
  LOGIN: "LOGIN",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type CreateAuditLogInput = {
  organizationId: string;
  userId: string;
  action: AuditAction | string;
  resource: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Writes an audit log entry. Swallows errors so audit logging never breaks
 * the primary operation it records.
 */
export async function createAuditLog(input: CreateAuditLogInput) {
  try {
    return await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch {
    return null;
  }
}

export type AuditLogListQuery = {
  organizationId: string;
  page?: number;
  pageSize?: number;
  action?: string | null;
  resource?: string | null;
  search?: string | null;
};

export async function listAuditLogs(query: AuditLogListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.AuditLogWhereInput = {
    organizationId: query.organizationId,
    ...(query.action ? { action: query.action } : {}),
    ...(query.resource ? { resource: query.resource } : {}),
    ...(query.search
      ? {
          OR: [
            { user: { name: { contains: query.search, mode: "insensitive" } } },
            { user: { email: { contains: query.search, mode: "insensitive" } } },
            { resourceId: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
