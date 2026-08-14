import { z } from "zod";
import { NOTIFICATION_PREFS } from "@/lib/constants/notifications";

export const listNotificationsSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
  unreadOnly: z.boolean().optional(),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export const markNotificationReadSchema = z.object({
  id: z.string().min(1),
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;

export const notificationPreferencesSchema = z.object({
  shipmentStatus: z.boolean().optional(),
  vehicleAlert: z.boolean().optional(),
  driverAlert: z.boolean().optional(),
  systemAlert: z.boolean().optional(),
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

export const NOTIFICATION_PREFERENCE_KEYS = NOTIFICATION_PREFS as readonly string[];