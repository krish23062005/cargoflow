/**
 * Notification types and their preference categories. Each type maps to one
 * of the toggleable categories a member can mute, plus the web channel flag.
 * Client-safe so the bell and preferences page can render labels/icons.
 */
export const NOTIFICATION_TYPES = [
  "SHIPMENT_STATUS_CHANGE",
  "VEHICLE_ALERT",
  "DRIVER_ALERT",
  "SYSTEM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Maps a notification type to its preference-category key. */
export const NOTIFICATION_CATEGORY: Record<NotificationType, string> = {
  SHIPMENT_STATUS_CHANGE: "shipmentStatus",
  VEHICLE_ALERT: "vehicleAlert",
  DRIVER_ALERT: "driverAlert",
  SYSTEM: "systemAlert",
};

/** Preference keys stored per member (row = member × org). */
export const NOTIFICATION_PREFS = [
  "shipmentStatus",
  "vehicleAlert",
  "driverAlert",
  "systemAlert",
  "email",
  "sms",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFS)[number];

export const NOTIFICATION_TYPE_META: {
  value: NotificationType;
  label: string;
  description: string;
}[] = [
  {
    value: "SHIPMENT_STATUS_CHANGE",
    label: "Shipment updates",
    description: "Pickup, transit, checkpoint and delivery status changes",
  },
  {
    value: "VEHICLE_ALERT",
    label: "Vehicle alerts",
    description: "ETA delays, geofence entries and unusual activity",
  },
  {
    value: "DRIVER_ALERT",
    label: "Driver alerts",
    description: "Licence expiring, new assignments and driver status",
  },
  {
    value: "SYSTEM",
    label: "System",
    description: "Invitations, role changes and account notices",
  },
];

export const getNotificationTypeLabel = (value: string) =>
  NOTIFICATION_TYPE_META.find((t) => t.value === value)?.label ?? value;