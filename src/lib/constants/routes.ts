export const WAYPOINT_TYPES = [
  "PICKUP",
  "DROPOFF",
  "FUEL_STOP",
  "REST_STOP",
  "BORDER_CROSSING",
  "CHECKPOINT",
] as const;

export type WaypointType = (typeof WAYPOINT_TYPES)[number];

export const WAYPOINT_TYPE_META: {
  value: WaypointType;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: "PICKUP",
    label: "Pickup",
    description: "Collection point",
    color: "#10b981",
  },
  {
    value: "DROPOFF",
    label: "Dropoff",
    description: "Delivery point",
    color: "#ef4444",
  },
  {
    value: "FUEL_STOP",
    label: "Fuel stop",
    description: "Refuelling stop",
    color: "#f59e0b",
  },
  {
    value: "REST_STOP",
    label: "Rest stop",
    description: "Driver rest / rest period",
    color: "#0ea5e9",
  },
  {
    value: "BORDER_CROSSING",
    label: "Border crossing",
    description: "Customs / international border",
    color: "#8b5cf6",
  },
  {
    value: "CHECKPOINT",
    label: "Checkpoint",
    description: "Intermediate checkpoint",
    color: "#64748b",
  },
];

export const getWaypointTypeMeta = (value: string) =>
  WAYPOINT_TYPE_META.find((t) => t.value === value) ?? {
    value,
    label: value.replace(/_/g, " "),
    description: "",
    color: "#64748b",
  };

export const getWaypointTypeLabel = (value: string) =>
  getWaypointTypeMeta(value).label.replace(/_/g, " ");

/**
 * Default waypoint type for a position in the sequence: first is a pickup,
 * last is a dropoff, everything between is a generic checkpoint.
 */
export function defaultWaypointType(index: number, total: number): WaypointType {
  if (total <= 1) return "CHECKPOINT";
  if (index === 0) return "PICKUP";
  if (index === total - 1) return "DROPOFF";
  return "CHECKPOINT";
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km === null || km === undefined) return "—";
  if (km >= 1000) return `${(km / 1000).toFixed(2)} km`;
  return `${km.toFixed(1)} km`;
}

export function formatDurationMin(min: number | null | undefined): string {
  if (min === null || min === undefined) return "—";
  const hours = Math.floor(min / 60);
  const minutes = Math.round(min % 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export const AFRICA_CENTER: [number, number] = [8.78, -4.5];
export const DEFAULT_ZOOM = 5;