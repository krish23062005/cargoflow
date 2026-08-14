import { createTRPCRouter, orgProcedure } from "@/trpc/init";
import {
  listNotificationsSchema,
  markNotificationReadSchema,
  notificationPreferencesSchema,
} from "@/lib/validators/notification";
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
} from "@/server/notification";

/**
 * Notifications are personal (per user) and org-scoped — every member can
 * read their own bell, mark items read, and set their delivery preferences.
 * No extra permission gate: the data is the caller's own.
 */
export const notificationRouter = createTRPCRouter({
  /**
   * Latest notifications for the active member, newest first.
   */
  list: orgProcedure
    .input(listNotificationsSchema)
    .query(async ({ ctx, input }) => {
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
      const skip = (page - 1) * pageSize;

      const where = {
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        ...(input.unreadOnly ? { read: false } : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.notification.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          skip,
          take: pageSize,
        }),
        ctx.prisma.notification.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }),

  /**
   * Unread count for the bell badge.
   */
  unreadCount: orgProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: {
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        read: false,
      },
    });
    return { count };
  }),

  /**
   * Mark one notification as read.
   */
  markRead: orgProcedure
    .input(markNotificationReadSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notification.updateMany({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          userId: ctx.user.id,
        },
        data: { read: true },
      });
    }),

  /**
   * Mark every notification in this org as read.
   */
  markAllRead: orgProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.notification.updateMany({
      where: {
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        read: false,
      },
      data: { read: true },
    });
  }),

  /**
   * The member's delivery preferences for the active organization.
   */
  preferences: orgProcedure.query(async ({ ctx }) => {
    return getNotificationPreferences(
      ctx.prisma,
      ctx.organizationId,
      ctx.user.id,
    );
  }),

  /**
   * Save delivery preferences.
   */
  updatePreferences: orgProcedure
    .input(notificationPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      return upsertNotificationPreferences(
        ctx.prisma,
        ctx.organizationId,
        ctx.user.id,
        input,
      );
    }),
});
