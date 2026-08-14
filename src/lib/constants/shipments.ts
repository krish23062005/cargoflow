export const SHIPMENT_STATUSES = [
  "PENDING_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_CHECKPOINT",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_META: {
  value: ShipmentStatus;
  label: string;
  description: string;
}[] = [
  { value: "PENDING_PICKUP", label: "Pending pickup", description: "Awaiting collection from origin" },
  { value: "PICKED_UP", label: "Picked up", description: "Collected from origin" },
  { value: "IN_TRANSIT", label: "In transit", description: "Moving to destination" },
  { value: "AT_CHECKPOINT", label: "At checkpoint", description: "At an intermediate checkpoint" },
  { value: "DELIVERED", label: "Delivered", description: "Handed over at destination" },
  { value: "CANCELLED", label: "Cancelled", description: "No longer being fulfilled" },
  { value: "RETURNED", label: "Returned", description: "Sent back to origin" },
];

export const getShipmentStatusLabel = (value: string) =>
  SHIPMENT_STATUS_META.find((s) => s.value === value)?.label ?? value;

export const isActiveShipmentStatus = (status: string) =>
  status === "PENDING_PICKUP" ||
  status === "PICKED_UP" ||
  status === "IN_TRANSIT" ||
  status === "AT_CHECKPOINT";

/**
 * Forward-only transitions. The shipment status flow; crossings to the same
 * or previous status are rejected so the timeline reads cleanly.
 */
export const NEXT_SHIPMENT_STATUSES: Record<string, ShipmentStatus[]> = {
  PENDING_PICKUP: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "RETURNED"],
  IN_TRANSIT: ["AT_CHECKPOINT", "DELIVERED"],
  AT_CHECKPOINT: ["IN_TRANSIT", "DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

export function getNextShipmentStatuses(status: string): ShipmentStatus[] {
  return NEXT_SHIPMENT_STATUSES[status as ShipmentStatus] ?? [];
}

export const CARGO_TYPES = [
  "GENERAL",
  "PERISHABLE",
  "FRAGILE",
  "LIQUID",
  "HAZARDOUS",
  "OVERSIZED",
  "LIVE_ANIMALS",
  "DOCUMENTS",
  "OTHER",
] as const;

export type CargoType = (typeof CARGO_TYPES)[number];

export const CARGO_TYPE_META: { value: CargoType; label: string }[] = [
  { value: "GENERAL", label: "General cargo" },
  { value: "PERISHABLE", label: "Perishable" },
  { value: "FRAGILE", label: "Fragile" },
  { value: "LIQUID", label: "Liquid" },
  { value: "HAZARDOUS", label: "Hazardous" },
  { value: "OVERSIZED", label: "Oversized" },
  { value: "LIVE_ANIMALS", label: "Live animals" },
  { value: "DOCUMENTS", label: "Documents" },
  { value: "OTHER", label: "Other" },
];

export const getCargoTypeLabel = (value: string) =>
  CARGO_TYPE_META.find((t) => t.value === value)?.label ?? value;

export const SHIPMENT_EVENT_TYPES = [
  "ASSIGNED",
  "STATUS_CHANGED",
  "CHECKPOINT",
  "POD_CAPTURED",
  "NOTE",
] as const;

export type ShipmentEventType = (typeof SHIPMENT_EVENT_TYPES)[number];

export const getShipmentEventTypeLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");