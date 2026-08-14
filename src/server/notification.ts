import type { Prisma } from "@/generated/prisma/client";
import { hasPermission, type Permission } from "@/lib/constants/permissions";
import {
  NOTIFICATION_CATEGORY,
  type NotificationType,
} from "@/lib/constants/notifications";
import type { NotificationPreferencesInput } from "@/lib/validators/notification";

type Db = Prisma.TransactionClient;

/** Read a member's notification preference row, defaulting all toggles on. */
export async function getNotificationPreferences(
  prisma: Db,
  organizationId: string,
  userId: string,
) {
  const existing = await prisma.notificationPreference.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });
  if (existing) return existing;
  return {
    id: "default",
    organizationId,
    userId,
    shipmentStatus: true,
    vehicleAlert: true,
    driverAlert: true,
    systemAlert: true,
    email: false,
    sms: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Core notify — creates an in-app `Notification` row (respecting the member's
 * category toggle) and dispatches email/SMS placeholders when enabled.
 * Never throws: notification delivery must not break the primary operation.
 *
 * Repeated alert types (`VEHICLE_ALERT` like "running late") are deduped per
 * user+type for `dedupMs` so a truck pinging every 10s doesn't flood the bell.
 */
export async function notify(
  prisma: Db,
  args: {
    organizationId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    dedupMs?: number;
  },
) {
  try {
    const prefs = await getNotificationPreferences(
      prisma,
      args.organizationId,
      args.userId,
    );
    const category = NOTIFICATION_CATEGORY[args.type];
    if (category && prefs[category as keyof typeof prefs] === false) return null;

    // Skip repeats of the same alert within the window (default 30 min).
    const dedupMs = args.dedupMs ?? 30 * 60_000;
    if (args.type === "VEHICLE_ALERT" || dedupMs > 0) {
      const recent = await prisma.notification.findFirst({
        where: {
          organizationId: args.organizationId,
          userId: args.userId,
          type: args.type,
          title: args.title,
          createdAt: { gte: new Date(Date.now() - dedupMs) },
        },
        select: { id: true },
      });
      if (recent) return recent;
    }

    const notification = await prisma.notification.create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        link: args.link,
        channel: "IN_APP",
      },
    });

    // Multi-channel delivery. Resend (email) and Africa's Talking/Twilio (SMS)
    // are not yet configured — treat the toggles as opt-in routing metadata
    // and log a placeholder so the plumbing is visible.
    if (prefs.email) {
      console.log(
        `[notification:email] → ${args.userId} · ${args.type} · ${args.title}`,
      );
    }
    if (prefs.sms) {
      console.log(
        `[notification:sms] → ${args.userId} · ${args.type} · ${args.title}`,
      );
    }

    return notification;
  } catch {
    return null;
  }
}

/**
 * Notify every member of an org whose role holds `permission` (the default
 * "all roles that can view shipments"). Bulk insert; per-user prefs still gate
 * delivery.
 */
export async function notifyByPermission(
  prisma: Db,
  args: {
    organizationId: string;
    permission?: Permission;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    excludeUserId?: string;
  },
) {
  try {
    const members = await prisma.member.findMany({
      where: { organizationId: args.organizationId },
      select: { userId: true, role: true },
    });
    if (members.length === 0) return 0;

    const permission = args.permission ?? "shipment.view";
    let count = 0;
    for (const member of members) {
      if (member.userId === args.excludeUserId) continue;
      if (!hasPermission(member.role, permission)) continue;
      const created = await notify(prisma, {
        organizationId: args.organizationId,
        userId: member.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        link: args.link,
      });
      if (created) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Upsert a member's notification preference row, returning the saved values.
 * Writes are best-effort (must never break the settings page).
 */
export async function upsertNotificationPreferences(
  prisma: Db,
  organizationId: string,
  userId: string,
  input: NotificationPreferencesInput,
) {
  return prisma.notificationPreference.upsert({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    create: {
      organizationId,
      userId,
      shipmentStatus: input.shipmentStatus ?? true,
      vehicleAlert: input.vehicleAlert ?? true,
      driverAlert: input.driverAlert ?? true,
      systemAlert: input.systemAlert ?? true,
      email: input.email ?? false,
      sms: input.sms ?? false,
    },
    update: {
      shipmentStatus: input.shipmentStatus,
      vehicleAlert: input.vehicleAlert,
      driverAlert: input.driverAlert,
      systemAlert: input.systemAlert,
      email: input.email,
      sms: input.sms,
    },
  });
}