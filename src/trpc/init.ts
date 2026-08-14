import { initTRPC, TRPCError } from "@trpc/server";
import { SuperJSON } from "superjson";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  hasPermission,
  isRoleAtLeast,
  type OrgRole,
  type Permission,
} from "@/lib/constants/permissions";

/**
 * Context built for every tRPC request. The session is resolved from the
 * incoming request headers so org scoping can be derived from the session's
 * `activeOrganizationId`.
 */
export async function createTRPCContext() {
  const h = await headers();
  const session = await auth.api.getSession({
    headers: h,
  });
  return { prisma, session, headers: h };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: SuperJSON,
  errorFormatter: ({ shape, error }) => {
    // Better Auth throws APIErrors shaped like { statusCode, status, body:
    // { message, code } }. tRPC wraps them as INTERNAL_SERVER_ERROR with the
    // original as `cause` — translate them into real tRPC errors so clients
    // surface the actual reason (e.g. "User is already invited to this
    // organization") instead of a generic 500.
    const cause = (error as Error).cause as
      | { statusCode?: unknown; body?: { message?: unknown } }
      | undefined;
    if (
      cause &&
      typeof cause === "object" &&
      typeof cause.statusCode === "number" &&
      cause.body &&
      typeof cause.body === "object"
    ) {
      return {
        ...shape,
        code: httpStatusToTRPCCode(cause.statusCode),
        message:
          typeof cause.body.message === "string"
            ? cause.body.message
            : shape.message,
      };
    }

    if (error.code === "INTERNAL_SERVER_ERROR") {
      return {
        ...shape,
        message:
          "Something went wrong on our end. Please try again, and contact support if it persists.",
      };
    }
    return shape;
  },
});

/** Map an HTTP status code to the closest tRPC error code. */
function httpStatusToTRPCCode(status: number) {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_CONTENT";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "BAD_REQUEST";
  }
}

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

/**
 * Middleware that requires an authenticated session and injects the user.
 */
const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in" });
  }
  return next({ ctx: { ...ctx, user: ctx.session.user } });
});

export const protectedProcedure = authedProcedure;

/**
 * orgProcedure — the only way to access organization-scoped data.
 *
 * Resolves the active organization from the session, verifies the user is a
 * member, and injects `organizationId`, `organization`, and `member` into the
 * context. Never query tenant data without going through this middleware.
 */
export const orgProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const organizationId = ctx.session?.session.activeOrganizationId;

  if (!organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active organization. Create or select an organization first.",
    });
  }

  const member = await ctx.prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: ctx.user.id,
      },
    },
  });

  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }

  const organization = await ctx.prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
  }

  return next({ ctx: { ...ctx, organizationId, organization, member } });
});

export type OrgProcedureCtx = { organizationId: string };

/**
 * requireRole — restricts a procedure to a minimum role tier using the
 * owner > admin > dispatcher > viewer > driver hierarchy.
 */
export function requireRole(minimum: OrgRole) {
  return orgProcedure.use(async ({ ctx, next }) => {
    if (!isRoleAtLeast(ctx.member.role, minimum)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires the ${minimum} role or higher`,
      });
    }
    return next({ ctx });
  });
}

/**
 * requirePermission — restricts a procedure to roles holding a specific
 * permission from the matrix in src/lib/constants/permissions.ts.
 */
export function requirePermission(permission: Permission) {
  return orgProcedure.use(async ({ ctx, next }) => {
    if (!hasPermission(ctx.member.role, permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action",
      });
    }
    return next({ ctx });
  });
}

/**
 * auditedProcedure — wraps a mutation (already behind orgProcedure / RBAC)
 * and writes an audit log entry after it succeeds. Accepts resolvers so the
 * entry can capture the affected resource id and request metadata.
 *
 * Pass `permission` to also enforce a permission from the matrix — every
 * audited *write* should do so, otherwise any member could trigger it.
 */
export function auditedProcedure(options: {
  permission?: Permission;
  resource: string;
  action: string;
  resourceId?: (rawInput: unknown, result: unknown) => string | null | undefined;
  metadata?: (rawInput: unknown) => Record<string, unknown> | null | undefined;
}) {
  const base = options.permission
    ? orgProcedure.use(async ({ ctx, next }) => {
        if (!hasPermission(ctx.member.role, options.permission!)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to perform this action",
          });
        }
        return next({ ctx });
      })
    : orgProcedure;

  return base.use(async ({ ctx, next, getRawInput }) => {
    const result = await next({ ctx });

    if (!result.ok) {
      return result;
    }

    try {
      const rawInput = await getRawInput();
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.user.id,
          resource: options.resource,
          action: options.action,
          resourceId: options.resourceId?.(rawInput, result.data) ?? null,
          metadata: (options.metadata?.(rawInput) ??
            undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: ctx.headers.get("x-forwarded-for") ?? undefined,
          userAgent: ctx.headers.get("user-agent") ?? undefined,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return result;
  });
}
